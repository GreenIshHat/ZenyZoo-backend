// static/game/js/main.js

import { getCSRFToken, fetchJson } from "./utils.js";
import { loadBoard, makeCard, applyFlips, updateScores } from "./ui.js";
import { loadDeck, attemptMove, triggerBotPlay, pollHumanMatch } from "./api.js";

window.addEventListener("DOMContentLoaded", () => {
  // ‣ Bail out if not on a battle page
  if (typeof window.playerId === "undefined" || typeof window.matchId === "undefined") {
    console.warn("⚠️ Not on battle page — exiting.");
    return;
  }

  // — Pull in templated globals —
  const playerId     = window.playerId;
  const yourName     = window.yourName;
  const matchId      = window.matchId;
  let   opponentId   = window.opponentId;
  let   opponentName = window.opponentName;
  let   isBotMatch   = window.isBotMatch;
  const csrftoken    = getCSRFToken();

  // — API endpoints —
  const deckApi   = `/game/api/battle-deck/${playerId}/`;
  const moveApi   = `/game/api/move/`;
  const statusApi = `/game/api/match/${matchId}/`;
  const botApi    = `/game/api/battle-bot/`;

  // — DOM refs —
  const boardEl    = document.getElementById("game-board");
  const deckEl     = document.getElementById("player-deck");
  const infoEl     = document.getElementById("player-turn");
  const scoreBarEl = document.getElementById("score-bar");
  const bannerEl   = document.getElementById("winner-banner");

  // — State & maps —
  let   currentTurn = null;
  const cellMap     = {};
  const cardMap     = {};
  const cardDataMap = {};

  // 1) Build 3×3 grid and grab references
  loadBoard(boardEl, pos => {
    if (currentTurn !== playerId) return;
    const sel = document.querySelector(".card.selected");
    if (!sel) return alert("Please select a card first.");
    attemptMove(moveApi, {
      match_id:  matchId,
      player_id: playerId,
      card_id:   +sel.dataset.pcId,
      position:  pos
    }, {
      csrftoken,
      onResult: handleResult
    });
  });
  Array.from(boardEl.children).forEach((cell, i) => {
    cellMap[i] = cell;
  });

  // 2) Load your deck, then initial state
  loadDeck(deckApi, deckEl, makeCard, cardMap, cardDataMap, () => {
    fetchJson(statusApi).then(renderState);
  });

  // 3) Poll for human–vs–human joins & moves
  pollHumanMatch(statusApi, {
    playerId,
    opponentId,
    isBotMatch,
    onJoin:    data => data.player_two_id && location.reload(),
    onOppMove: ()   => fetchJson(statusApi).then(renderState)
  });

  // ─── Render full board & trigger bot ──────────────────────────────

  function renderState(data) {
    // a) If a bot just joined, reload so our template picks it up
    if (!opponentId && data.player_two_id) {
      opponentId   = data.player_two_id;
      opponentName = data.player_two;
      isBotMatch   = data.player_two_is_bot;
      return location.reload();
    }

    // b) Clear any previous in-cell cards
    boardEl.querySelectorAll(".in-cell").forEach(el => el.remove());

    // c) Draw every move on the board
    data.board.forEach(m => {
      const el = makeCard(m);
      el.classList.add(
        "in-cell",
        m.player_id === playerId ? "my-card" : "opponent-card",
        "fade-in"
      );
      boardEl.children[m.position].appendChild(el);
    });

    // d) Grey out used deck cards
    Object.values(cardMap).forEach(tile => {
      const used = data.board.some(m => +tile.dataset.pcId === m.player_card_id);
      tile.classList.toggle("used", used);
      tile.classList.remove("selected");
    });

    // e) Process flips, scores, banner & turn text
    handleResult(data);

    // f) If it’s the bot’s turn now, fire off its move
    if (isBotMatch && data.current_turn_id === opponentId && !data.game_over) {
      triggerBotPlay(botApi, { match_id: matchId }, {
        csrftoken,
        onResult: handleResult
      });
    }
  }

  function handleResult(data) {
    // 1) Animate flips for human and bot
    applyFlips(cellMap, data.flips    || []);
    applyFlips(cellMap, data.bot_flips||[]);

    // 2) Update the score bar
    updateScores(scoreBarEl, data.scores);

    // 3) Game-over or next turn
    if (data.game_over) {
      bannerEl.textContent = `🏁 ${data.winner} wins!`;
      bannerEl.style.display = "block";
    } else {
      bannerEl.style.display = "none";
      infoEl.textContent = data.current_turn_id === playerId
        ? `Your turn, ${yourName}`
        : `${opponentName}'s turn`;
      currentTurn = data.current_turn_id;
    }
  }
});
