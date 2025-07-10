// static/game/js/controller.js

import {
    loadBoard,
    applyFlips,
    updateScores,
    makeCard,
    greyOutCardElement
} from "./ui.js";
// import { startMatchPolling } from "./polling.js";
import { initDeck } from "./deck.js";
import { fetchJson, getCSRFToken } from "./utils.js";
import * as sfx from "./sfx.js";

export class GameController {
    constructor(opts) {
        Object.assign(this, opts);
        this.lastPlays = new Set();
        this.yourName = opts.yourName;    // ← store your username
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
        deck.forEach(cd => {
            this.cardDataMap[cd.player_card_id] = cd;
        });

        // 3) Initial load: draw current board + scores + turn
        try {
            const init = await fetchJson(this.stateUrl);

            // ─── Store the two player IDs for later score‐lookup ─────────
            this.playerOneId = init.player_one_id;
            this.playerTwoId = init.player_two_id;

            // ─── Draw whatever’s already on the board ───────────────────────
            this._renderIncremental(init);

            // ─── Update scores keyed by player IDs ────────────────────────
            // updateScores(this.scoreBar, {
            //   [this.playerOneId]: init.scores[this.playerOneId],
            //   [this.playerTwoId]: init.scores[this.playerTwoId]
            // });
     // display the named_scores if available, else fallback to numeric p1/p2
     if (init.named_scores) {
       updateScores(this.scoreBar, init.named_scores);
     } 


            // ─── Set the turn & timer ──────────────────────────────────────
            this.updateTurn(init);
        } catch (e) {
            console.error("Initial load failed:", e);
        }

        // 4) Start background music
        sfx.playBackground();

        // 5) Open our match WebSocket (takes the place of polling)
        this.socketUrl = (window.location.protocol === "https:" ? "wss" : "ws")
            + "://" + window.location.host
            + `/ws/match/${this.matchId}/`;
        this.reconnectDelay = 1000;

        this._connectSocket();
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
            updateScores(this.scoreBar, data.named_scores);
        }

        // game-over
        if (data.game_over && !this.gameOver) {
            this.gameOver = true;
            //this.stopPolling();
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
            updateScores(this.scoreBar, full.named_scores);

            // 5) Banner if game over
            // after re-fetching full state into `full`:
            if (full.game_over && !this.gameOver) {
                this.gameOver = true;
                //this.stopPolling();
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


// _connectSocket
// static/game/js/controller.js
GameController.prototype._connectSocket = function() {
  console.log(`[WS] connecting to ${this.socketUrl}`);
  this.socket = new WebSocket(this.socketUrl);

  this.socket.onopen = () => {
    console.log("[WS] connected");
    this.reconnectDelay = 1000;
  };

  this.socket.onmessage = ({ data }) => {
    const msg = JSON.parse(data);

    // 1) FULL‐board vs incremental
    if (Array.isArray(msg.board)) {
      this.lastPlays.clear();
      this._renderFullBoard(msg.board);
    } else {
      this._renderIncremental(msg);
    }

    // 2) scores
    if (msg.p1_score != null && msg.p2_score != null) {
      updateScores(this.scoreBar, msg.named_scores);
    }

    // 3) turn
    if (msg.current_turn_id != null) {
      this.updateTurn(msg);
    }

    // 4) game‐over banner
    if (msg.game_over && !this.gameOver) {
      this.gameOver = true;
      sfx.stopBackground();
      const isWin = msg.winner_id === this.playerId;
      this.banner.textContent = isWin ? "🎉 You win!" : "😢 You lose!";
      this.banner.style.display = "block";
      isWin ? sfx.playWin() : sfx.playLose();
      if (isWin) sfx.fireConfetti();
    }
  };

  this.socket.onclose = (e) => {
    console.warn(
      `[WS] closed (code=${e.code}) — retrying in ${this.reconnectDelay}ms`
    );
    setTimeout(() => this._connectSocket(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  };

  this.socket.onerror = (err) => {
    console.error("[WS] error", err);
  };
};
// static/game/js/controller.js
GameController.prototype.handleForfeit = async function() {
  try {
    const resp = await fetch("/game/api/match/forfeit/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken()
      },
      body: JSON.stringify({
        match_id: this.matchId,
        player_id: this.playerId
      })
    });
    if (!resp.ok) throw new Error(`Forfeit failed (${resp.status})`);
  } catch (err) {
    console.error("Forfeit error:", err);
  }
};
GameController.prototype._startTimer = function() {
  clearInterval(this.timerInterval);
  let remaining = 60;
  this.timerEl.textContent = `00:${String(remaining).padStart(2, "0")}`;
  this.timerInterval = setInterval(() => {
    remaining--;
    if (remaining >= 0) {
      this.timerEl.textContent = `00:${String(remaining).padStart(2, "0")}`;
    } else {
      clearInterval(this.timerInterval);
      console.log("[Timer] Expired — auto-forfeit");
+     this.handleForfeit();
    }
  }, 1000);
};



// override makeMove to send via WS instead of fetch
GameController.prototype.makeMove = async function(position) {
  if (!this.selectedCardId) {
    alert("Select a card first!");
    return;
  }

  // 1) Optimistic UI
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

  // 2) Attempt WebSocket first
  const payload = {
    type:    "move",
    payload: {
      match_id:  this.matchId,
      player_id: this.playerId,
      card_id:   this.selectedCardId,
      position
    }
  };

  const sendOverHttp = async () => {
    try {
      const resp = await fetch(this.makeMoveUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken":   getCSRFToken()
        },
        body: JSON.stringify(payload.payload)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      // server returns the full state? if not, fetch it yourself:
      const full = await fetchJson(this.stateUrl);
      this.lastPlays.clear();
      this._renderFullBoard(full.board);
      updateScores(this.scoreBar, full.named_scores);
      this.updateTurn(full);
    } catch (err) {
      console.error("HTTP fallback failed:", err);
      alert("Move failed: " + err.message);
    }
  };

  if (this.socket && this.socket.readyState === WebSocket.OPEN) {
    try {
        // send the move
  this.socket.send(JSON.stringify({
    type: "move",
    payload: { match_id: this.matchId, player_id: this.playerId, card_id: this.selectedCardId, position }
  }));
  this.selectedCardId = null;

  // start a forfeit‐timer: if bot never replies in 58s, you win
  clearTimeout(this._botForfeitTimer);
  this._botForfeitTimer = setTimeout(() => {
    // !! TODO; should verify w server
    if (!this.gameOver) {
      this.gameOver = true;
      sfx.stopBackground();
      this.banner.textContent = "⚠️ Opponent timed out — you win by forfeit!";
      this.banner.style.display = "block";
      sfx.playWin();
      sfx.fireConfetti();
      // optionally: call a real forfeit‐API endpoint here
    }
  }, 58000);
    } catch (wsErr) {
      console.warn("WebSocket send error, falling back to HTTP:", wsErr);
      await sendOverHttp();
    }
  } else {
    // socket not open yet
    console.warn("WebSocket not open, using HTTP fallback");
    await sendOverHttp();
  }

  // 3) clear selection
  this.selectedCardId = null;
};