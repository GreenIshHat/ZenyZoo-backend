// static/game/script.js

console.log("🧩 battle script is running");
let gameOver = false;
// keep track of which positions we’ve already rendered
const seenMoves = new Set();

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
  const yourName    = window.yourName;
  const matchId     = window.matchId;
  const opponentId   = window.opponentId;
  const opponentName = window.opponentName;
  const isBotMatch   = window.isBotMatch;
  const csrftoken   = getCSRFToken();

  console.log("playerId=", playerId,
              "matchId=", matchId,
              "opponentId=", opponentId,
              "isBotMatch=", isBotMatch);

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

/**
 * Update scores, detect end-of-game, set the info bar, kick off
 * the bot if it’s their turn — AND apply any flips that just happened.
 */
function handlePostMove(data) {
  // 0) Apply flips if present (human or bot)
  if (Array.isArray(data.flips)) {
    applyFlips(data.flips);
  }
  if (Array.isArray(data.bot_flips)) {
    applyFlips(data.bot_flips);
  }

  // 1) Update scores
  if (data.scores) updateScores(data.scores);

  // 2) Game over?
  if (data.game_over) {
    gameOver = true;
    // show banner
    const banner = document.getElementById("winner-banner");
    banner.textContent = `🏁 ${data.winner} wins!`;
    banner.style.display = "block";

    // hide the turn line
    //document.getElementById("info-bar").style.display = "none";

    // lock the board visually
    document.getElementById("battle-wrapper")
            .classList.add("battle-over");
    return;
  }

  // 3) Not over: hide banner & show info-bar
  document.getElementById("winner-banner").style.display = "none";
  const infoBarEl = document.getElementById("info-bar");
  infoBarEl.style.display = "block";

  // 4) Set current turn & label
  currentTurn = data.current_turn_id;
  const turnText = (currentTurn === playerId)
    ? `Your turn, ${yourName}`
    : `${data.current_turn_name}'s turn`;
  document.getElementById("player-turn").textContent = turnText;

  // 5) Auto‐trigger bot if needed
  if (isBotMatch && currentTurn === opponentId) {
    setTimeout(triggerBotPlay, 250);
  }
}


/**
 * Fetch full match state—board, scores, turn—and repaint everything.
 */
function loadInitialState() {
  // 1) Rebuild the empty 3×3 grid
  // loadBoard();

  // 2) Fetch the latest match state
  fetch(matchStatusApi, { credentials: "same-origin" })
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => {

      // 2) Add only new moves
      data.board.forEach(m=>{
        if (!seenMoves.has(m.position)) {
          seenMoves.add(m.position);
          const cell = cellMap[m.position];
          const cd = {
            player_card_id: m.player_card_id,
            card_name:      m.card_name,
            image:          m.image,
            card_top:       m.card_top,
            card_right:     m.card_right,
            card_bottom:    m.card_bottom,
            card_left:      m.card_left
          };
          const ownerClass = (m.player_id===playerId)?'my-card':'opponent-card';
          const el = makeCard(cd);
          el.classList.add("in-cell", ownerClass, "fade-in");
          cell.appendChild(el);
        }
      });

      // // 3) Paint each move into its pre‐built cell
      // data.board.forEach(move => {
      //   const cell = cellMap[move.position];
      //   // clear any previous card
      //   cell.innerHTML = "";

      //   const cd = {
      //     player_card_id: move.player_card_id,
      //     card_name:      move.card_name,
      //     image:          move.image,
      //     card_top:       move.card_top,
      //     card_right:     move.card_right,
      //     card_bottom:    move.card_bottom,
      //     card_left:      move.card_left
      //   };
      //   const el = makeCard(cd);
      //   el.classList.add(
      //     "in-cell",
      //     move.player_id === playerId ? "my-card" : "opponent-card"
      //   );
      //   cell.appendChild(el);
      // });

      // 4) Mark used deck tiles
      Object.values(cardMap).forEach(el => {
        const pcId = parseInt(el.dataset.pcId, 10);
        const used = data.board.some(m => m.player_card_id === pcId);
        el.classList.toggle("used", used);
        el.classList.remove("selected");
      });

      // 5) Update scores, turn, and possibly trigger bot
      handlePostMove({
        current_turn_id:   data.current_turn_id,
        current_turn_name	: data.current_turn_name,
        game_over:      !data.is_active,
        winner:         data.winner,
        scores:         data.scores
      });
    })
    .catch(err => console.error("loadInitialState error:", err));
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
  const parts = Object.entries(scores)
                      .map(([name, count]) => `${name}: ${count}`);
  bar.textContent = parts.join(" — ");
}


function attemptMove(pos) {
  if (gameOver) return;
  const sel = document.querySelector(".card.selected");
  if (!sel || currentTurn !== playerId) return;

  const pcId = parseInt(sel.dataset.pcId, 10);
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
  .then(r => r.ok ? r.json() : Promise.reject(r.status))
  .then(() => {
    // after your move (and auto-bot under handlePostMove), just reload everything
    setTimeout(loadInitialState, 200);
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
          loadInitialState()

        })
        .catch(err => console.warn("pollTurn error:", err));
    }, 5000);
  }

  
function triggerBotPlay() {
  fetch(battleBotApi, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrftoken
    },
    body: JSON.stringify({ match_id: matchId })
  })
  .then(r => r.ok ? r.json() : Promise.reject(r.status))
  .then(data => {
    // 1) Paint the bot’s new card if present
    if (data.bot_move) {
      const bm = data.bot_move;
      const el = makeCard(bm);
      // apply owner class
      el.classList.add(
        "in-cell",
        bm.player_id === playerId ? "my-card" : "opponent-card"
      );
      cellMap[bm.position].appendChild(el);
      // grey out the used tile in your deck panel
      const tile = cardMap[bm.player_card_id];
      if (tile) tile.classList.add("used");
    }

    // 2) Now hand off flips / scores / turn logic
    handlePostMove(data);
  })
  .catch(err => console.error("triggerBotPlay error:", err));
}



loadBoard();
loadDeck();           // will call loadInitialState() after loading deck
pollTurn();


});
