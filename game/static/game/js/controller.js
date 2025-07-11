import { loadBoard, updateScores, makeCard, greyOutCardElement } from "./ui.js";
import { initDeck } from "./deck.js";
import { fetchJson, getCSRFToken } from "./utils.js";
import * as sfx from "./sfx.js";

class Timer {
    constructor(displayEl, onExpire) {
        this.displayEl = displayEl;
        this.onExpire = onExpire;
        this.interval = null;
        this.remaining = 0;
    }
    start() {
        this.stop();
        this.remaining = 60;
        this._updateDisplay();
        this.interval = setInterval(() => {
            this.remaining--;
            if (this.remaining >= 0) {
                this._updateDisplay();
            } else {
                this.stop();
                this.onExpire();
            }
        }, 1000);
    }
    stop() {
        clearInterval(this.interval);
        this.displayEl.textContent = "";
    }
    _updateDisplay() {
        this.displayEl.textContent = `00:${String(this.remaining).padStart(2,'0')}`;
    }
}

export class GameController {
    constructor(opts) {
        Object.assign(this, opts);
        this.lastPlays = new Set();
        this.playedCardIds = new Set();
        this.currentTurnId = null;
        this.selectedCardId = null;
        this.cardDataMap = {};
        this.gameOver = false;
        this.botDelay = opts.botDelay || 500;
        this.timer = new Timer(this.timerEl, this.handleForfeit.bind(this));
        this.playerNamesById = {};
        this.init();
    }

async init() {
    loadBoard(this.boardEl, this.onCellClick.bind(this));
    this.cellMap = {};
    this.boardEl.querySelectorAll(".cell").forEach(c => {
        this.cellMap[+c.dataset.position] = c;
    });

    const deck = await initDeck({
        playerId: this.playerId,
        container: this.handEl,
        onCardSelect: id => this.selectedCardId = id
    });
    deck.forEach(cd => this.cardDataMap[cd.player_card_id] = cd);

    try {
        const init = await fetchJson(this.stateUrl);
        this.playerNamesById[init.player_one_id] = init.player_one;
        this.playerNamesById[init.player_two_id] = init.player_two;

        // **NEW**: map each player’s ID to their color
        this.playerColors = {
            [init.player_one_id]: '#1f77b4',
            [init.player_two_id]: '#ff7f0e'
        };

        this._updateScores(this._formatScores(init));
        this._renderFullBoard(init.board || []);
        this.updateTurn(init);

        if (init.forfeited) {
            this.gameOver = true;
            sfx.stopBackground();
            this.timer.stop();
            this.banner.textContent = `⌛ ${init.winner} forfeited.`;
            this.banner.style.display = "block";
        }
    } catch (e) {
        console.error("Initial load failed:", e);
    }

    sfx.playBackground();
    this.socketUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/match/${this.matchId}/`;
    this.reconnectDelay = 1000;
    this._connectSocket();
}


    _formatScores(data) {
        if (data.named_scores) return data.named_scores;
        const raw = data.scores || { p1_score: data.p1_score, p2_score: data.p2_score };
        return {
            [this.playerNamesById[data.player_one_id]]: raw[data.player_one_id] ?? raw.p1_score,
            [this.playerNamesById[data.player_two_id]]: raw[data.player_two_id] ?? raw.p2_score
        };
    }

    _updateScores(scores) {
        updateScores(this.scoreBar, scores);
    }

    _placeMove(mv) {
        const cell = this.cellMap[mv.position];
        if (cell.children.length || this.playedCardIds.has(mv.player_card_id)) return;
        const isMe = mv.player_id === this.playerId;
        const key = `${isMe ? 'p' : 'b'}-${mv.position}`;
        if (this.lastPlays.has(key)) return;
        this.lastPlays.add(key);
        this.playedCardIds.add(mv.player_card_id);
        cell.innerHTML = "";
        const cardEl = makeCard(mv);
        cardEl.classList.add("in-cell", isMe ? "my-card" : "opponent-card");
        if (mv.color) {
            cardEl.style.borderColor = mv.color;
            cardEl.style.boxShadow = `0 0 10px ${mv.color}`;
        }
        cardEl.style.opacity = "0";
        cardEl.style.transition = "opacity 1s ease";
        cell.appendChild(cardEl);
        requestAnimationFrame(() => { cardEl.style.opacity = "1"; });
        isMe ? (greyOutCardElement(mv.player_card_id), sfx.playPlace()) : sfx.playBot();
    }

    _renderFullBoard(boardArr) {
        this.lastPlays.clear();
        this.playedCardIds.clear();
        boardArr.forEach(mv => this._placeMove(mv));
    }

async makeMove(position) {
    if (!this.selectedCardId || this.gameOver) return;
    const cd = this.cardDataMap[this.selectedCardId];
    const move = {
        position,
        player_id:      this.playerId,
        player_card_id: this.selectedCardId,
        template_card_id: cd.template_card_id,
        card_name:      cd.name,
        image:          cd.image,
        card_top:       cd.stats.top,
        card_right:     cd.stats.right,
        card_bottom:    cd.stats.bottom,
        card_left:      cd.stats.left,
        // **NEW**: include optimistic color for immediate UI styling
        color: this.playerColors[this.playerId]
    };
    this._placeMove(move);
    greyOutCardElement(this.selectedCardId);

    const payload = { match_id: this.matchId, player_id: this.playerId, card_id: this.selectedCardId, position };
    if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "move", payload }));
    } else {
        try {
            const full = await fetchJson(this.stateUrl);
            this._renderFullBoard(full.board);
            this._updateScores(this._formatScores(full));
            this.updateTurn(full);
        } catch (err) {
            console.error("Move failed:", err);
        }
    }
    this.selectedCardId = null;
}


    onCellClick(evt) {
        if (this.gameOver || evt.target.closest(".card.used") || this.currentTurnId !== this.playerId) return;
        this.makeMove(+evt.currentTarget.dataset.position);
    }

    updateTurn(data) {
        const incoming = Number(data.current_turn_id);
        if (incoming !== this.currentTurnId) {
            this.currentTurnId = incoming;
            this.playerTurnEl.textContent = data.current_turn_name;
            incoming === this.playerId ? this.timer.start() : this.timer.stop();
        }
    }

    _connectSocket() {
        this.socket = new WebSocket(this.socketUrl);
        this.socket.onopen = () => this.reconnectDelay = 1000;
        this.socket.onmessage = async () => {
            if (this.gameOver) return;
            try {
                const full = await fetchJson(this.stateUrl);
                this._renderFullBoard(full.board);
                this._updateScores(this._formatScores(full));
                this.updateTurn(full);
                if (full.game_over) this._handleGameOver(full.winner_id);
            } catch (e) {
                console.error("WS state fetch failed:", e);
            }
        };
        this.socket.onclose = () => { if (!this.gameOver) setTimeout(() => this._connectSocket(), this.reconnectDelay *= 2); };
        this.socket.onerror = e => console.error("WS error", e);
    }

    _handleGameOver(winnerId) {
        this.gameOver = true;
        sfx.stopBackground();
        this.timer.stop();
        const win = winnerId === this.playerId;
        this.banner.textContent = win ? "🎉 You win!" : winnerId === null ? "🤝 Draw!" : "😢 You lose!";
        this.banner.style.display = "block";
        if (win) sfx.fireConfetti();
        this.socket.close();
    }

    async handleForfeit() {
        if (this.gameOver) return;
        this.timer.stop();
        this.gameOver = true;
        sfx.stopBackground();
        this.banner.textContent = "⌛ Time's up! You forfeited.";
        this.banner.style.display = "block";
        sfx.playLose();
        this.socket && this.socket.close();
        try {
            const full = await fetchJson(this.stateUrl);
            this._renderFullBoard(full.board);
            this._updateScores(this._formatScores(full));
        } catch (e) {
            console.error("Failed to fetch state after forfeit:", e);
        }
        try {
            await fetch("/game/api/match/forfeit/", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFToken() }, body: JSON.stringify({ match_id: this.matchId, player_id: this.playerId }) });
        } catch (e) {
            console.error("Forfeit request failed:", e);
        }
    }
}
