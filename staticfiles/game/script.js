// static/game/script.js

console.log("🧩 battle script is running");
let gameOver = false;

function getCSRFToken() {
  const name = "csrftoken=";
  const cookie = document.cookie.split("; ").find(c => c.startsWith(name));
  return cookie ? cookie.slice(name.length) : null;
}

document.addEventListener("DOMContentLoaded", () => {
  // Ensure these globals exist
  if (typeof window.playerId === "undefined" || typeof window.matchId === "undefined") {
    console.warn("⚠️ Not on battle page—exiting");
    return;
  }

  const playerId    = window.playerId;
  const matchId     = window.matchId;
  const csrftoken   = getCSRFToken();

  console.log("playerId=", playerId, "matchId=", matchId, "csrftoken=", csrftoken);

const deckApi        = `/game/api/battle-deck/${playerId}/`;
const moveApi        = `/game/api/move/`;
const matchStatusApi = `/game/api/match/${matchId}/`;
const battleBotApi   = `/game/api/battle-bot/`;


  const boardContainer = document.getElementById("game-board");
  const deckContainer  = document.getElementById("player-deck");
  const infoBar        = document.getElementById("player-turn");

  let currentTurn = null;
  const cellMap    = {};  // position → cell element
  const cardMap     = {};  // player_card_id → deck tile element
  const cardDataMap = {};  // player_card_id → full card data object


  // Build empty 3×3 grid
  function loadBoard() {
    boardContainer.innerHTML = "";  // clear if re-running
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.index = i;
      cell.addEventListener("click", () => attemptMove(i));
      boardContainer.appendChild(cell);
      cellMap[i] = cell;
    }
  }

  // Helper to build card tile (deck or grid)
  function makeCard(card) {
    const wrapper = document.createElement("div");
    wrapper.className = "card";
    // store the PlayerCard PK if provided
    if (card.player_card_id !== undefined) {
      wrapper.dataset.pcId = card.player_card_id;
    }
    wrapper.title = card.card_name || card.name;
    wrapper.innerHTML = `
      <div class="card-face" style="background-image:url('${card.image}')"></div>
      <span class="stat stat-top">${card.card_top ?? card.stats.top}</span>
      <span class="stat stat-right">${card.card_right ?? card.stats.right}</span>
      <span class="stat stat-bottom">${card.card_bottom ?? card.stats.bottom}</span>
      <span class="stat stat-left">${card.card_left ?? card.stats.left}</span>
    `;
    return wrapper;
  }

  // Load your deck of 7 cards
function loadDeck() {
  deckContainer.innerHTML = "";
  fetch(deckApi, { credentials: "same-origin" })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(json => {
      json.battle_deck.forEach(cd => {
        // stash full data for placement later
        cardDataMap[cd.player_card_id] = cd;

        // build & register tile
        const el = makeCard(cd);
        cardMap[cd.player_card_id] = el;

        el.addEventListener("click", () => {
          // deselect all, then select if not used
          Object.values(cardMap).forEach(c => c.classList.remove("selected"));
          if (!el.classList.contains("used")) {
            el.classList.add("selected");
          }
        });

        deckContainer.appendChild(el);
      });
      // now that deck is up, paint existing moves
      loadInitialState();
    })
    .catch(e => console.error("loadDeck error:", e));
}

// static/game/script.js
/**
 * Update scores, detect end-of-game, set the info bar, and kick off
 * the bot if it’s their turn.
 */
function handlePostMove(data) {
  // 1) Update live scores
  if (data.scores) {
    updateScores(data.scores);
  }

  // 2) Check for game over
  if (data.game_over) {
    gameOver = true;
    infoBar.textContent = `🏁 ${data.winner} wins!`;
    document.getElementById("battle-wrapper")
            .classList.add("battle-over");
    return;   // stop here—no further turn logic
  }

  // 3) Set current turn & friendly label
  currentTurn = data.next_turn_id;
  if (currentTurn === playerId) {
    infoBar.textContent = `Your turn, ${yourName}`;
  } else {
    infoBar.textContent = `${opponentName}'s turn`;
  }

  // 4) Auto-trigger bot if it’s a bot match and it’s their ID
  if (isBotMatch && currentTurn === opponentId) {
    setTimeout(triggerBotPlay, 250);
  }
}


  function loadInitialState() {
  fetch(matchStatusApi, { credentials: "same-origin" })
    .then(resp => {
      if (!resp.ok) throw new Error(`Status API ${resp.status}`);
      return resp.json();
    })
    .then(data => {
      data.board.forEach(move => {
        const cell = cellMap[move.position];
        // 1) paint the in‐cell card if not already
        if (!cell.querySelector(".card.in-cell")) {
          const cd = {
            player_card_id: move.player_card_id,
            card_name:      move.card_name,
            image:          move.image,
            card_top:       move.card_top,
            card_right:     move.card_right,
            card_bottom:    move.card_bottom,
            card_left:      move.card_left
          };
          const ownerClass = (move.player_id === playerId)
            ? 'my-card'
            : 'opponent-card';
          const el = makeCard(cd);
          el.classList.add("in-cell", ownerClass);
          cell.appendChild(el);
        }

      

        // 2) mark that deck tile used
        const dt = cardMap[move.player_card_id];
        if (dt && !dt.classList.contains("used")) {
          dt.classList.add("used");
        }
      });

      handlePostMove(data);
    })
    .catch(err => console.warn("loadInitialState error:", err));
}


function applyFlips(flips) {
  flips.forEach(fp => {
    const cell = cellMap[fp];
    cell.classList.add("flipped");

    // swap owner highlight
    const cardEl = cell.querySelector(".card.in-cell");
    if (cardEl.classList.contains("my-card")) {
      cardEl.classList.replace("my-card", "opponent-card");
    } else {
      cardEl.classList.replace("opponent-card", "my-card");
    }

    // optional: remove the .flipped marker after a brief flash
    setTimeout(() => cell.classList.remove("flipped"), 400);
  });
}



function updateScores(scores) {
  const bar = document.getElementById("score-bar");
  const parts = Object.entries(scores).map(([u,c]) => `${u}: ${c}`);
  bar.textContent = parts.join(" — ");
}



function attemptMove(pos) {
  if (gameOver) return;    

  const sel = document.querySelector(".card.selected");
  if (!sel || currentTurn !== playerId) return;

  const pcId = parseInt(sel.dataset.pcId, 10);
  const cd   = cardDataMap[pcId];
  if (!cd) return console.error("Missing cardData for", pcId);

  fetch(moveApi, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrftoken
    },
    body: JSON.stringify({
      match_id:  matchId,
      player_id: playerId,
      card_id:   pcId,
      position:  pos
    })
  })
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(data => {
    if (data.error) return alert(data.error);

    // paint your move...
    const cell = cellMap[pos];
    const yourEl = makeCard(cd);
    yourEl.classList.add("in-cell", "my-card");
    cell.appendChild(yourEl);
    sel.classList.add("used");
    sel.classList.remove("selected");
    applyFlips(data.flips);

      handlePostMove(data);
  })
  .catch(err => console.error("attemptMove error:", err));
}


  // Keep turn updated (in case of spectator or long wait)
  function pollTurn() {
    setInterval(() => {
      fetch(matchStatusApi, { credentials: "same-origin" })
        .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(data => {
          currentTurn = data.current_turn_id;
          infoBar.textContent = `Current turn: ${data.current_turn_name}`;
        })
        .catch(err => console.warn("pollTurn error:", err));
    }, 3000);
  }

  /**
 * Tell the server to have the bot play one move, then refresh.
 */
function triggerBotPlay() {
  fetch('/game/api/battle-bot/', {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrftoken
    },
    body: JSON.stringify({ match_id: matchId })
  })
  .then(r => {
    if (!r.ok) throw new Error(`Bot API ${r.status}`);
    return r.json();
  })
  .then(data => {
    // 1) Paint bot's new card
    if (data.bot_move) {
      const bm = data.bot_move;
      const el = makeCard(bm);
      el.classList.add("in-cell");
      cellMap[bm.position].appendChild(el);
      // mark deck tile used
      const dt = cardMap[bm.player_card_id];
      if (dt) dt.classList.add("used");
      // apply flips
      // (data.bot_flips||[]).forEach(fp => cellMap[fp].classList.add("flipped"));
      applyFlips(data.flips);

    }

    // 2) Update turn display
    currentTurn = data.next_turn_id;
    infoBar.textContent = `Current turn: ${data.next_turn_name}`;
  })
  .catch(err => console.error("triggerBotPlay error:", err));
}

loadBoard();
loadDeck();
loadInitialState();
pollTurn();

});
