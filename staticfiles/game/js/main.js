// static/game/js/main.js

import { getCSRFToken, fetchJson } from "./utils.js";
import { loadBoard, makeCard, applyFlips, updateScores } from "./ui.js";
import { loadDeck, attemptMove, triggerBotPlay, pollHumanMatch } from "./api.js";

window.addEventListener("DOMContentLoaded", () => {
  // ─── Bail if not on a battle page ─────────────────────────────
  if (typeof window.playerId === "undefined" || typeof window.matchId === "undefined") {
    console.warn("⚠️ Not on battle page — exiting.");
    return;
  }

  // ─── Globals from Django template ─────────────────────────────
  const playerId     = window.playerId;
  const yourName     = window.yourName;
  const matchId      = window.matchId;
  let   opponentId   = window.opponentId;
  let   opponentName = window.opponentName;
  let   isBotMatch   = window.isBotMatch;
  const csrftoken    = getCSRFToken();

  // ─── API endpoints ────────────────────────────────────────────
  const deckApi   = `/game/api/battle-deck/${playerId}/`;
  const moveApi   = `/game/api/move/`;
  const statusApi = `/game/api/match/${matchId}/`;
  const botApi    = `/game/api/battle-bot/`;

  // ─── DOM refs ─────────────────────────────────────────────────
  const boardEl    = document.getElementById("game-board");
  const deckEl     = document.getElementById("player-deck");
  const infoEl     = document.getElementById("player-turn");
  const scoreBarEl = document.getElementById("score-bar");
  const bannerEl   = document.getElementById("winner-banner");

  // ─── State & maps ─────────────────────────────────────────────
  let   currentTurn = null;
  const seenMoves   = new Set();
  const cellMap     = {};
  const cardMap     = {};
  const cardDataMap = {};

  // ─── 1) Build grid + click handler ────────────────────────────
  loadBoard(boardEl, pos => {
    if (currentTurn !== playerId) return;
    const sel = document.querySelector(".card.selected");
    if (!sel) return alert("Please select a card first.");

    // Draw our card immediately:
    const pcId = +sel.dataset.pcId;
    const cd   = cardDataMap[pcId];
    const humanCard = makeCard({
      player_card_id: pcId,
      image:          cd.image,
      card_name:      cd.name,
      card_top:       cd.stats.top,
      card_right:     cd.stats.right,
      card_bottom:    cd.stats.bottom,
      card_left:      cd.stats.left
    });
    humanCard.classList.add("in-cell","my-card","fade-in");
    boardEl.children[pos].appendChild(humanCard);
    seenMoves.add(pos);
    sel.classList.add("used");
    sel.classList.remove("selected");

    // Send move
    attemptMove(moveApi, {
      match_id:  matchId,
      player_id: playerId,
      card_id:   pcId,
      position:  pos
    }, {
      csrftoken,
      onResult: handleResult
    });
  });
  // stash the cell elements for flips
  Array.from(boardEl.children).forEach((cell, i) => cellMap[i] = cell);

  // ─── 2) Load deck → initial state ─────────────────────────────
  loadDeck(deckApi, deckEl, makeCard, cardMap, cardDataMap, () => {
    fetchJson(statusApi).then(renderState).catch(e => console.error("Error loading state:", e));
  });

  // ─── 3) Poll human-vs-human ───────────────────────────────────
  pollHumanMatch(statusApi, {
    playerId,
    opponentId,
    isBotMatch,
    onJoin:    data => data.player_two_id && location.reload(),
    onOppMove: ()   => fetchJson(statusApi).then(renderState)
  });

  // ─── State rendering & handlers ───────────────────────────────

  function renderState(data) {
    // If finished match, persist banner and stop
    if (!data.is_active) {
      bannerEl.textContent  = `🏁 ${data.winner} wins!`;
      bannerEl.style.display = "block";
      updateScores(scoreBarEl, data.scores);
      return;
    }

    // New opponent joined?
    if (!opponentId && data.player_two_id) {
      opponentId   = data.player_two_id;
      opponentName = data.player_two;
      isBotMatch   = data.player_two_is_bot;
      return location.reload();
    }

  // 1) Clear every card out of the grid
  Array.from(boardEl.children).forEach(cell => {
    cell.innerHTML = '';
  });

  // 2) Draw each persisted move
  data.board.forEach(m => {
    // Make sure the API really returned these fields:
    // position, player_id, player_card_id, card_name, image, card_top, card_right, card_bottom, card_left
    const move = {
      position:       m.position,
      player_id:      m.player_id,
      player_card_id: m.player_card_id,
      card: {
        id:    m.player_card_id,
        name:  m.card_name,
        image: m.image,
        stats: {
          top:    m.card_top,
          right:  m.card_right,
          bottom: m.card_bottom,
          left:   m.card_left,
        }
      }
    };
    const el = makeCard(move);
    el.classList.add(
      m.player_id === playerId ? 'my-card' : 'opponent-card',
      'in-cell', 'fade-in'
    );
    boardEl.children[m.position].appendChild(el);
  });

  // 3) Update “used” state on your hand
  Array.from(deckEl.children).forEach(tile => {
    const pcId = Number(tile.dataset.pcId);
    const used = data.board.some(m => m.player_card_id === pcId);
    tile.classList.toggle('used', used);
  });

    // Flips / scores / banner / turn text
    handleResult(data);

    // If it’s the bot’s turn, fire after 2 s so you see your move
    if (isBotMatch && data.current_turn_id === opponentId && !data.game_over) {
      setTimeout(() => {
        triggerBotPlay(botApi, { match_id: matchId }, {
          csrftoken,
          onResult: handleResult
        });
      }, 2000);
    }
  }

  function handleResult(data) {
    // Animate flips
    applyFlips(cellMap, data.flips    || []);
    applyFlips(cellMap, data.bot_flips||[]);
    // Update score bar
    updateScores(scoreBarEl, data.scores);

    // Game-over?
    if (data.game_over) {
      bannerEl.textContent  = `🏁 ${data.winner} wins!`;
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
