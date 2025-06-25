import { loadBoard, makeCard, applyFlips, updateScores } from "./ui.js";
import { getCSRFToken, fetchJson } from "./utils.js";
import {
  loadDeck,
  attemptMove,
  triggerBotPlay,
  pollHumanMatch
} from "./api.js";

window.addEventListener("DOMContentLoaded", () => {
  // Bail out if not a battle page
  if (typeof window.playerId === "undefined" || typeof window.matchId === "undefined") {
    console.warn("⚠️ Not on battle page — exiting.");
    return;
  }

  // — Pull from Django template tags —
  const playerId     = window.playerId;
  const yourName     = window.yourName;
  const matchId      = window.matchId;
  let   opponentId   = window.opponentId;
  let   opponentName = window.opponentName;
  let   isBotMatch   = window.isBotMatch;

  // — API endpoints —
  const deckApi   = `/game/api/battle-deck/${playerId}/`;
  const moveApi   = `/game/api/move/`;
  const statusApi = `/game/api/match/${matchId}/`;
  const botApi    = `/game/api/battle-bot/`;

  // — DOM refs —
  const boardEl = document.getElementById("game-board");
  const deckEl  = document.getElementById("player-deck");
  const infoEl  = document.getElementById("player-turn");
  const seenMoves = new Set();
  let   currentTurn = null;
  const cellMap    = {};
  const cardMap    = {};
  const cardDataMap= {};

  // 1) Build board and store cells in cellMap
  loadBoard(boardEl, pos => {
    if (currentTurn !== playerId) return;
    const sel = document.querySelector(".card.selected");
    if (!sel) return alert("Please select a card first.");
    attemptMove(moveApi, {
      match_id:  matchId,
      player_id: playerId,
      card_id:   +sel.dataset.pcId,
      position:  pos
    }, { onResult: handleResult });
  });
  Array.from(boardEl.children).forEach((cell, i) => cellMap[i] = cell);

  // 2) Load deck, then initial match state
  loadDeck(deckApi, deckEl, makeCard, cardMap, cardDataMap, () => {
    fetchJson(statusApi)
      .then(renderState)
      .catch(e => console.error("Error loading state:", e));
  });

  // 3) Poll for human-vs-human events
  pollHumanMatch(statusApi, {
    playerId,
    opponentId,
    isBotMatch,
    onJoin:    data => data.player_two_id && location.reload(),
    onOppMove: ()   => fetchJson(statusApi).then(renderState)
  });

  // ─── State rendering & handlers ────────────────────────────────

  function renderState(data) {
    // A new opponent joined?
    if (!opponentId && data.player_two_id) {
      opponentId   = data.player_two_id;
      opponentName = data.player_two;
      isBotMatch   = data.player_two_is_bot;
      return location.reload();
    }

    // Draw only brand-new moves
    data.board.forEach(m => {
      if (!seenMoves.has(m.position)) {
        seenMoves.add(m.position);
        const el = makeCard(m);
        el.classList.add(
          m.player_id===playerId ? "my-card" : "opponent-card",
          "in-cell","fade-in"
        );
        boardEl.children[m.position].appendChild(el);
      }
    });

    // Grey-out used cards
    Object.values(cardMap).forEach(tile => {
      tile.classList.toggle(
        "used",
        data.board.some(m=>+tile.dataset.pcId===m.player_card_id)
      );
    });

    // Flips/scores/game-over
    handleResult(data);

    // If it’s the bot’s turn, trigger it
    if (isBotMatch && data.current_turn_id===opponentId && !data.game_over) {
      triggerBotPlay(botApi, { match_id: matchId }, { onResult: handleResult });
    }
  }

  function handleResult(data) {
    applyFlips(cellMap, data.flips   || []);
    applyFlips(cellMap, data.bot_flips||[]);
    updateScores(infoEl, data.scores);

    if (data.game_over) {
      const banner = document.getElementById("winner-banner");
      banner.textContent = `🏁 ${data.winner} wins!`;
      banner.style.display = "block";
    } else {
      infoEl.textContent = data.current_turn_id===playerId
        ? `Your turn, ${yourName}`
        : `${opponentName}'s turn`;
      currentTurn = data.current_turn_id;
    }
  }
});
