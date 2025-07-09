// static/game/js/controller.js

import { loadBoard, makeCard, applyFlips, updateScores } from "./ui.js";
import { startMatchPolling }      from "./polling.js";
import { initDeck }               from "./deck.js";
import { fetchJson, getCSRFToken }from "./utils.js";
import * as sfx                   from "./sfx.js";

export class GameController {
  constructor(opts) {
    Object.assign(this, opts);
    this.boardEl   = document.getElementById("game-board");
    this.deckEl    = document.getElementById("player-deck");
    this.turnEl    = document.getElementById("player-turn");
    this.scoreBar  = document.getElementById("score-bar");
    this.banner    = document.getElementById("winner-banner");
    this.selectedCard = null;
    this.cellMap      = {};
    this.init();
  }

  async init() {
    // 0) background music
    sfx.playBackground();

    // 1) draw empty grid & stash cell references
    loadBoard(this.boardEl, pos => this.onCellClick(pos));
    Array.from(this.boardEl.children)
         .forEach((cell,i) => this.cellMap[i] = cell);

    // 2) load your deck
    this.cardDataMap = await initDeck({
      playerId: this.playerId,
      container: this.deckEl,
      onCardSelect: pcId => this.onCardSelect(pcId)
    });

    // 3) fetch initial match‐state
    let data;
    try {
      data = await fetchJson(`/game/api/match/${this.matchId}/state/`);
    } catch (e) {
      console.error("Error loading initial state:", e);
      return;
    }

    // 4) render full history
    if (Array.isArray(data.board)) {
      this.drawHistory(data.board);
    }

    // 5) render latest moves (in case API also sent player_move/bot_move)
    this.drawMoves(data);

    // 6) render flips, scores, winner‐banner
    this.renderState(data);

    // 7) turn indicator
    this.updateTurn(data);

    // 8) start polling
    this.stopPolling = startMatchPolling({
      statusUrl:    `/game/api/match/${this.matchId}/`,
      stateUrl:     `/game/api/match/${this.matchId}/state/`,
      playerId:     this.playerId,
      onJoin:       ()   => location.reload(),
      onOppMove:    d => { this.drawMoves(d); this.renderState(d); },
      onUpdateTurn: d => this.updateTurn(d)
    });
  }

  // draw every historical move
  drawHistory(board) {
    board.forEach(m => {
      const el = makeCard(m);
      el.classList.add(
        m.player_id === this.playerId ? "my-card" : "opponent-card",
        "in-cell","fade-in"
      );
      this.cellMap[m.position].appendChild(el);
    });
  }

  // draw just the “latest” human + bot move
  drawMoves(data) {
    if (data.player_move) {
      const m = data.player_move;
      const el = makeCard(m);
      el.classList.add("in-cell","my-card","fade-in");
      this.cellMap[m.position].appendChild(el);
      sfx.playPlace();
    }
    if (data.bot_move) {
      const m = data.bot_move;
      const el = makeCard(m);
      el.classList.add("in-cell","opponent-card","fade-in");
      this.cellMap[m.position].appendChild(el);
      sfx.playBot();
    }
  }

  async onCellClick(pos) {
    if (this.currentTurn !== this.playerId) {
      return alert("🚫 Not your turn!");
    }
    if (!this.selectedCard) {
      return alert("Select a card first");
    }
    const csrftoken = getCSRFToken();
    const payload = {
      match_id:  this.matchId,
      player_id: this.playerId,
      card_id:   this.selectedCard,
      position:  pos
    };
    const data = await fetchJson("/game/api/move/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken":   csrftoken
      },
      body: JSON.stringify(payload)
    });

    // append new cards, re‐render flips/scores/turn
    this.drawMoves(data);
    this.renderState(data);
    this.updateTurn(data);
  }

  onCardSelect(pcId) {
    this.deckEl.querySelectorAll(".card.selected")
      .forEach(e => e.classList.remove("selected"));
    const el = this.deckEl.querySelector(`[data-pc-id="${pcId}"]`);
    if (el) {
      el.classList.add("selected");
      this.selectedCard = pcId;
    }
  }

  updateTurn(data) {
    if (!data.is_active) {
      this.turnEl.textContent = "Game over";
      if (typeof this.stopPolling === "function") this.stopPolling();
      return;
    }
    this.currentTurn = data.current_turn_id;
    const isMe = data.current_turn_id === this.playerId;
    this.turnEl.textContent = isMe
      ? "Your turn"
      : `${data.current_turn_name}’s turn`;
  }

  renderState(data) {
    // apply any flips + sfx
    if (data.flips?.length)     { applyFlips(this.cellMap, data.flips);     sfx.playFlip(); }
    if (data.bot_flips?.length) { applyFlips(this.cellMap, data.bot_flips); sfx.playFlip(); }

    // update scores
    if (data.scores) updateScores(this.scoreBar, data.scores);

    // winner banner
    if (data.game_over) {
      this.banner.textContent = `🏁 ${data.winner} wins!`;
      this.banner.style.display = "block";
      sfx.playWin();
      sfx.fireConfetti();
    } else {
      this.banner.style.display = "none";
    }
  }
}
