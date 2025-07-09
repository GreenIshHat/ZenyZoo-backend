// static/game/js/controller.js

import {
    loadBoard,
    applyFlips,
    updateScores,
    makeCard,
    greyOutCardElement
} from "./ui.js";
import { startMatchPolling } from "./polling.js";
import { initDeck } from "./deck.js";
import { fetchJson, getCSRFToken } from "./utils.js";
import * as sfx from "./sfx.js";

export class GameController {
    constructor(opts) {
        Object.assign(this, opts);
        this.lastPlays = new Set();
        this.yourName      = opts.yourName;    // ← store your username
        this.currentTurnId = null;
        this.timerInterval = null;
        this.selectedCardId = null;
        this.cardDataMap = {};   // player_card_id → card metadata
        this.init();
    }

    async init() {
        // 1) Draw empty grid
        loadBoard(this.boardEl, this.onCellClick.bind(this));
        this.cellMap = {};
        this.boardEl.querySelectorAll(".cell").forEach(c => {
            this.cellMap[+c.dataset.position] = c;
        });

        // 2) Load your hand *and* capture the deck data
        const deck = await initDeck({
            playerId: this.playerId,
            container: this.handEl,
            onCardSelect: id => this.selectedCardId = id
        });
        // build quick lookup of stats by player_card_id
        deck.forEach(cd => {
            this.cardDataMap[cd.player_card_id] = cd;
        });

        // 3) Initial load: draw current board + scores + turn
        try {
            const init = await fetchJson(this.stateUrl);
            this._renderIncremental(init);
            updateScores(this.scoreBar, init.scores);
            this.updateTurn(init);
        } catch (e) {
            console.error("Initial load failed:", e);
        }

        // 4) Start background music
        sfx.playBackground();

        // 5) Start polling for opponent & turn updates
        this.stopPolling = startMatchPolling(
            {
                statusUrl: this.statusUrl,
                stateUrl: this.stateUrl,
                playerId: this.playerId,
                onOppMove: this._renderIncremental.bind(this),
                onUpdateTurn: this.updateTurn.bind(this),
            },
            { humInterval: 4000, turnInterval: 2000 }
        );
    }

    /**
     * Unified incremental renderer.
     * Handles BOTH a full `data.board` array (polling)
     * and a move‐response ({player_move, bot_move, flips}).
     */
    _renderIncremental(data) {
        // Case A: polling payload with board[]
        if (Array.isArray(data.board)) {
            data.board.forEach(mv => this._placeMove(mv));
        }
        // Case B: POST(make_move) response
        else {
            // Optimistic replay: if we already drew it, skip
            if (data.player_move) this._placeMove(data.player_move);
            if (data.bot_move) this._placeMove(data.bot_move);
            // only play flip when there *are* flips
            if (data.flips?.length) {
                applyFlips(this.cellMap, data.flips);
                sfx.playFlip();
            }
            if (data.bot_flips?.length) {
                applyFlips(this.cellMap, data.bot_flips);
                sfx.playFlip();
            }
        }

        // update scoreboard
        if (data.scores) {
            updateScores(this.scoreBar, data.scores);
        }

        // game-over
    if (data.game_over && !this.gameOver) {
      this.gameOver = true;
      this.stopPolling();
      sfx.stopBackground();

      // Compare against yourName, not the turn label!
    const isWin = data.winner_id === this.playerId;
      this.banner.textContent = isWin
        ? "🎉 You win!"
        : "😢 You lose!";
      this.banner.style.display = "block";

      if (isWin) {
        sfx.playWin();
        sfx.fireConfetti();
      } else {
        sfx.playLose();
      }
}

    }

    /**
     * Places one card on the board.
     * Expects mv = { position, player_id, player_card_id, image, stats/name... }
     */
    _placeMove(mv) {
        const isMe = mv.player_id === this.playerId;
        const key = `${isMe ? "p" : "b"}-${mv.position}`;
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


    // Fully re‐draw every cell from scratch
    _renderFullBoard(boardArr) {
        boardArr.forEach(mv => {
            const isMe = mv.player_id === this.playerId;
            const whoCls = isMe ? "my-card" : "opponent-card";
            const key = `${isMe ? "p" : "b"}-${mv.position}`;

            this.lastPlays.add(key);
            const cell = this.cellMap[mv.position];
            cell.innerHTML = "";

            const cardEl = makeCard(mv);
            cardEl.classList.add("in-cell", whoCls);
            cell.appendChild(cardEl);

            if (isMe) greyOutCardElement(mv.player_card_id);
        });
    }

    /**
     * Click handler: optimistic UI + POST + reconcile
     */

    async makeMove(position) {
        if (!this.selectedCardId) {
            alert("Select a card first!");
            return;
        }

        // 1) Optimistically place your card
        const cd = this.cardDataMap[this.selectedCardId];
        this._placeMove({
            position,
            player_id: this.playerId,
            player_card_id: this.selectedCardId,
            template_card_id: cd.template_card_id,
            card_name: cd.name,
            image: cd.image,
            card_top: cd.stats.top,
            card_right: cd.stats.right,
            card_bottom: cd.stats.bottom,
            card_left: cd.stats.left
        });
        greyOutCardElement(this.selectedCardId);

        // 2) Send to server
        try {
            const response = await fetch(this.makeMoveUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCSRFToken()
                },
                body: JSON.stringify({
                    match_id: this.matchId,
                    player_id: this.playerId,
                    card_id: this.selectedCardId,
                    position
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            await response.json();  // ignore; we’ll do a fresh state fetch

            // 3) Now fetch the full state to get both boards, flips, scores, and game_over
            const full = await fetchJson(this.stateUrl);

            // 4) Clear and re-render everything:
            this.lastPlays.clear();
            this._renderFullBoard(full.board);
            updateScores(this.scoreBar, full.scores);

            // 5) Banner if game over
                // after re-fetching full state into `full`:
    if (full.game_over && !this.gameOver) {
      this.gameOver = true;
      this.stopPolling();
      sfx.stopBackground();

    const isWin = full.winner_id === this.playerId;
      this.banner.textContent = isWin
        ? "🎉 You win!"
        : "😢 You lose!";
      this.banner.style.display = "block";

      if (isWin) {
        sfx.playWin();
        sfx.fireConfetti();
      } else {
        sfx.playLose();
      }
    }

            // 6) Reset the timer if it’s back to your turn
            this.updateTurn(full);
            if (full.current_turn_id === this.playerId) {
                this._startTimer();
            }

            this.selectedCardId = null;
        } catch (err) {
            console.error("makeMove failed:", err);
            alert("Move failed: " + err.message);
        }
    }


    onCellClick(evt) {
        // block clicking greyed out deck cards
        const deckCard = evt.target.closest(".card[data-pc-id]");
        if (deckCard && deckCard.classList.contains("used")) {
            alert("You've already played that card!");
            return;
        }

        // only allow board-cell clicks when it's your turn
        const pos = +evt.currentTarget.dataset.position;
        if (this.currentTurnId !== this.playerId || this.cellMap[pos].children.length)
            return;

        this.makeMove(pos);
    }


    // helper to start a fresh 60s countdown
    _startTimer() {
        clearInterval(this.timerInterval);
        let remaining = 60;
        this.timerEl.textContent = `00:${String(remaining).padStart(2, "0")}`;
        this.timerInterval = setInterval(() => {
            remaining--;
            if (remaining >= 0) {
                this.timerEl.textContent = `00:${String(remaining).padStart(2, "0")}`;
            } else {
                clearInterval(this.timerInterval);
                console.log("[Timer] Expired");
            }
        }, 1000);
    }

    // helper to stop & clear the countdown
    _stopTimer() {
        clearInterval(this.timerInterval);
        this.timerEl.textContent = "";
    }

    /**
     * Called whenever the turn‐poll fires.
     * Only resets the timer when the incoming turn differs from our stored one.
     */
    updateTurn(data) {
        // normalize to numbers
        const incoming = Number(data.current_turn_id);
        const prev = Number(this.currentTurnId);
        console.log(`[Timer] updateTurn called: incoming=${incoming}, prev=${prev}`);

        if (incoming !== prev) {
            // record & update UI
            this.currentTurnId = incoming;
            this.playerTurnEl.textContent = data.current_turn_name;

            // if it’s now *your* turn, start; else stop
            if (incoming === this.playerId) {
                console.log("[Timer] You gained the turn — starting timer");
                this._startTimer();
            } else {
                console.log("[Timer] You lost the turn — clearing timer");
                this._stopTimer();
            }
        } else {
            console.log("[Timer] Turn unchanged — leaving timer running");
        }
    }


}
