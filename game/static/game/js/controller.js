import {
    loadBoard,
    applyFlips,
    updateScores,
    makeCard,
    greyOutCardElement
} from "./ui.js";
import { initDeck } from "./deck.js";
import { fetchJson, getCSRFToken } from "./utils.js";
import * as sfx from "./sfx.js";

/**
 * Fixes applied:
 * - Corrected handleForfeit prototype attachment
 * - Removed obsolete stopPolling references
 * - Unified board rendering in _renderIncremental and _renderFullBoard (clearing lastPlays)
 * - Simplified score updates to prefer named_scores with fallback to numeric
 * - Consolidated HTTP fallback logic in makeMove
 * - Added auto-forfeit on timer expiry
 * - Optimized WebSocket reconnect logic and error handling
 */
export class GameController {
    constructor(opts) {
        Object.assign(this, opts);
        this.lastPlays = new Set();
        this.currentTurnId = null;
        this.timerInterval = null;
        this.selectedCardId = null;
        this.cardDataMap = {};
        this.init();
    }

    async init() {
        // 1) Draw board grid
        loadBoard(this.boardEl, this.onCellClick.bind(this));
        this.cellMap = {};
        this.boardEl.querySelectorAll(".cell").forEach(c => {
            this.cellMap[+c.dataset.position] = c;
        });

        // 2) Load hand
        const deck = await initDeck({
            playerId: this.playerId,
            container: this.handEl,
            onCardSelect: id => this.selectedCardId = id
        });
        deck.forEach(cd => {
            this.cardDataMap[cd.player_card_id] = cd;
        });

        // 3) Initial state: draw board, scores, turn
        try {
            const init = await fetchJson(this.stateUrl);
            this.playerOneId = init.player_one_id;
            this.playerTwoId = init.player_two_id;

            // update scores
            const scores = init.named_scores || {
                [this.playerOneId]: init.scores[this.playerOneId],
                [this.playerTwoId]: init.scores[this.playerTwoId]
            };
            updateScores(this.scoreBar, scores);

            // render and set turn
            this._renderFullBoard(init.board || []);
            this.updateTurn(init);
        } catch (e) {
            console.error("Initial load failed:", e);
        }

        // 4) Background music
        sfx.playBackground();

        // 5) WebSocket for live updates
        this.socketUrl = (window.location.protocol === "https:" ? "wss" : "ws") +
            "://" + window.location.host +
            `/ws/match/${this.matchId}/`;
        this.reconnectDelay = 1000;
        this._connectSocket();
    }

    _renderIncremental(data) {
        if (Array.isArray(data.board)) {
            // fallback: full board
            this._renderFullBoard(data.board);
            return;
        }
        // incremental moves
        if (data.player_move) this._placeMove(data.player_move);
        if (data.bot_move)    this._placeMove(data.bot_move);
        if (data.flips?.length)    applyFlips(this.cellMap, data.flips);
        if (data.bot_flips?.length) applyFlips(this.cellMap, data.bot_flips);
    }

    _placeMove(mv) {
        const isMe = mv.player_id === this.playerId;
        const key = `${isMe ? 'p' : 'b'}-${mv.position}`;
        if (this.lastPlays.has(key)) return;
        this.lastPlays.add(key);

        const cell = this.cellMap[mv.position];
        cell.innerHTML = "";
        const cardEl = makeCard(mv);
        cardEl.classList.add("in-cell", isMe ? "my-card" : "opponent-card");
        cell.appendChild(cardEl);

        if (isMe) {
            greyOutCardElement(mv.player_card_id);
            sfx.playPlace();
        } else {
            sfx.playBot();
        }
    }

    _renderFullBoard(boardArr) {
        this.lastPlays.clear();
        boardArr.forEach(mv => this._placeMove(mv));
    }

    async makeMove(position) {
        if (!this.selectedCardId) return alert("Select a card first!");
        // optimistic UI
        const cd = this.cardDataMap[this.selectedCardId];
        this._placeMove({
            position,
            player_id:        this.playerId,
            player_card_id:   this.selectedCardId,
            template_card_id: cd.template_card_id,
            card_name:        cd.name,
            image:            cd.image,
            card_top:         cd.stats.top,
            card_right:       cd.stats.right,
            card_bottom:      cd.stats.bottom,
            card_left:        cd.stats.left
        });
        greyOutCardElement(this.selectedCardId);

        const payload = { type: "move", payload: { match_id: this.matchId, player_id: this.playerId, card_id: this.selectedCardId, position } };

        // HTTP fallback
        const httpFallback = async () => {
            try {
                const resp = await fetch(this.makeMoveUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCSRFToken()
                    },
                    body: JSON.stringify(payload.payload)
                });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const full = await fetchJson(this.stateUrl);
                this._renderFullBoard(full.board);
                const scores = full.named_scores || {
                    [this.playerOneId]: full.scores[this.playerOneId],
                    [this.playerTwoId]: full.scores[this.playerTwoId]
                };
                updateScores(this.scoreBar, scores);
                this.updateTurn(full);
            } catch (err) {
                console.error("HTTP fallback failed:", err);
                alert("Move failed: " + err.message);
            }
        };

        if (this.socket?.readyState === WebSocket.OPEN) {
            try {
                this.socket.send(JSON.stringify(payload));
            } catch (e) {
                console.warn("WS send error, fallback to HTTP", e);
                await httpFallback();
            }
        } else {
            await httpFallback();
        }
        this.selectedCardId = null;
    }

    onCellClick(evt) {
        if (evt.target.closest(".card.used")) return;
        const pos = +evt.currentTarget.dataset.position;
        if (this.currentTurnId !== this.playerId) return;
        if (this.cellMap[pos].children.length) return;
        this.makeMove(pos);
    }

    _startTimer() {
        clearInterval(this.timerInterval);
        let rem = 60;
        this.timerEl.textContent = `00:${String(rem).padStart(2,'0')}`;
        this.timerInterval = setInterval(() => {
            if (--rem >= 0) {
                this.timerEl.textContent = `00:${String(rem).padStart(2,'0')}`;
            } else {
                clearInterval(this.timerInterval);
                console.log("[Timer] Expired — forfeit");
                this.handleForfeit();
            }
        }, 1000);
    }

    _stopTimer() {
        clearInterval(this.timerInterval);
        this.timerEl.textContent = "";
    }

    updateTurn(data) {
        const incoming = Number(data.current_turn_id);
        if (incoming !== this.currentTurnId) {
            this.currentTurnId = incoming;
            this.playerTurnEl.textContent = data.current_turn_name;
            incoming === this.playerId ? this._startTimer() : this._stopTimer();
        }
    }
}

// WebSocket wiring
GameController.prototype._connectSocket = function() {
    this.socket = new WebSocket(this.socketUrl);
    this.socket.onopen  = () => this.reconnectDelay = 1000;
    this.socket.onmessage = ({data}) => {
        const msg = JSON.parse(data);
        if (Array.isArray(msg.board)) {
            this._renderFullBoard(msg.board);
        } else {
            this._renderIncremental(msg);
            if (msg.flips)    applyFlips(this.cellMap, msg.flips);
            if (msg.bot_flips) applyFlips(this.cellMap, msg.bot_flips);
        }
        const scores = msg.named_scores || { [this.playerOneId]: msg.p1_score, [this.playerTwoId]: msg.p2_score };
        updateScores(this.scoreBar, scores);
        if (msg.current_turn_id != null) this.updateTurn(msg);
        if (msg.game_over && !this.gameOver) {
            this.gameOver = true;
            sfx.stopBackground();
            this._stopTimer();
            const win = msg.winner_id === this.playerId;
            this.banner.textContent = win ? "🎉 You win!" : "😢 You lose!";
            this.banner.style.display = "block";
            win ? sfx.playWin() : sfx.playLose();
            if (win) sfx.fireConfetti();
        }
    };
    this.socket.onclose = () => setTimeout(() => this._connectSocket(), this.reconnectDelay *= 2);
    this.socket.onerror = e => console.error("WS error", e);
};

// Forfeit helper
GameController.prototype.handleForfeit = async function() {
    await fetch("/game/api/match/forfeit/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCSRFToken()
        },
        body: JSON.stringify({ match_id: this.matchId, player_id: this.playerId })
    });
};
