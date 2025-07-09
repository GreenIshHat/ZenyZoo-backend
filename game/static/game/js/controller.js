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
    this.lastPlays     = new Set();
    this.currentTurnId = null;
    this.timerInterval = null;
    this.selectedCardId = null;
    this.init();
  }

  async init() {
    // 1) Draw empty board
    loadBoard(this.boardEl, this.onCellClick.bind(this));
    this.cellMap = {};
    this.boardEl.querySelectorAll(".cell").forEach(c => {
      this.cellMap[+c.dataset.position] = c;
    });

    // 2) Load hand
    await initDeck({
      playerId:     this.playerId,
      container:    this.handEl,
      onCardSelect: id => this.selectedCardId = id
    });

    // 3) Initial state fetch
    try {
      const init = await fetchJson(this.stateUrl);
      this._renderIncremental(init);
      updateScores(this.scoreBar, init.scores);
      this.updateTurn(init);
    } catch (e) {
      console.error("Initial load failed:", e);
    }

    // start background music
    sfx.playBackground();

    // 4) Polling
    this.stopPolling = startMatchPolling(
      {
        statusUrl:    this.statusUrl,
        stateUrl:     this.stateUrl,
        playerId:     this.playerId,
        onOppMove:    this._renderIncremental.bind(this),
        onUpdateTurn: this.updateTurn.bind(this),
      },
      { humInterval: 4000, turnInterval: 2000 }
    );
  }

  /**
   * Handles either:
   *  - polling data { board: [...] , scores, game_over, ... }
   *  - move-response data { player_move, bot_move, flips, bot_flips, ... }
   */
  _renderIncremental(data) {
    // Case A: full board array
    if (Array.isArray(data.board)) {
      data.board.forEach(mv => this._placeMove(mv));
    }
    // Case B: move-response shape
    else {
      // human move
      if (data.player_move) {
        this._placeMove(data.player_move);
      }
      // bot move
      if (data.bot_move) {
        this._placeMove(data.bot_move);
      }
      // flips
      if (data.flips?.length) {
        applyFlips(this.cellMap, data.flips);
        sfx.playFlip();
      }
      if (data.bot_flips?.length) {
        applyFlips(this.cellMap, data.bot_flips);
        sfx.playFlip();
      }
    }

    // Update scores & game-over banner in both cases
    if (data.scores) {
      updateScores(this.scoreBar, data.scores);
    }
    if (data.p1_score != null && data.p2_score != null) {
      // if you prefer top-level scores:
      updateScores(this.scoreBar, { p1: data.p1_score, p2: data.p2_score });
    }
    if (data.game_over) {
      this.banner.textContent   = `🏁 ${data.winner} wins!`;
      this.banner.style.display = "block";
      sfx.playWin();
      sfx.fireConfetti();
    }
  }

  /**
   * Place a single move MV = { position, player_id, player_card_id, ... }
   */
  _placeMove(mv) {
    const isMe   = mv.player_id === this.playerId;
    const whoCls = isMe ? "my-card" : "opponent-card";
    const key    = `${isMe ? "p" : "b"}-${mv.position}`;

    if (this.lastPlays.has(key)) return;
    this.lastPlays.add(key);

    const cell = this.cellMap[mv.position];
    cell.innerHTML = "";

    const cardEl = makeCard(mv);
    cardEl.classList.add("in-cell", whoCls);
    cell.appendChild(cardEl);

    if (isMe) {
      greyOutCardElement(mv.player_card_id);
      sfx.playPlace();
    } else {
      sfx.playFlip();
    }
  }

  async makeMove(position) {
    if (!this.selectedCardId) {
      console.warn("Select a card first");
      return;
    }
    try {
      const data = await fetch(this.makeMoveUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken":  getCSRFToken()
        },
        body: JSON.stringify({
          match_id:  this.matchId,
          player_id: this.playerId,
          card_id:   this.selectedCardId,
          position
        })
      }).then(r => r.json());

      // treat POST response like a delta
      this._renderIncremental(data);
      this.updateTurn(data);
      this.selectedCardId = null;
    } catch (e) {
      console.error("makeMove failed:", e);
    }
  }

  onCellClick(evt) {
    // if they clicked a card in their hand...
    const cardEl = evt.target.closest(".card[data-pc-id]");
    if (cardEl && cardEl.classList.contains("used")) {
      alert("You’ve already played that card!");
      return;
    }

    // then your normal guards:
    const pos = +evt.currentTarget.dataset.position;
    if (this.currentTurnId !== this.playerId) return;
    if (this.cellMap[pos].children.length) return;
    this.makeMove(pos);
  }

  updateTurn(data) {
    const prev = this.currentTurnId;
    this.currentTurnId = data.current_turn_id;
    this.playerTurnEl.textContent = data.current_turn_name;

    // start/reset only on actual turn-change
    if (this.currentTurnId === this.playerId && prev !== this.playerId) {
      clearInterval(this.timerInterval);
      let sec = 60;
      this.timerEl.textContent = `00:${String(sec).padStart(2,"0")}`;
      this.timerInterval = setInterval(() => {
        if (--sec >= 0) {
          this.timerEl.textContent = `00:${String(sec).padStart(2,"0")}`;
        } else {
          clearInterval(this.timerInterval);
        }
      }, 1000);

    } else if (prev === this.playerId && this.currentTurnId !== this.playerId) {
      clearInterval(this.timerInterval);
      this.timerEl.textContent = "";
    }
  }
}
