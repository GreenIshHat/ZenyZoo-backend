// static/game/script.js

console.log("🧩 battle script is running");
let gameOver     = false;
const seenMoves  = new Set();   // positions already painted

function getCSRFToken() {
  const name = "csrftoken=";
  const cookie = document.cookie.split("; ").find(c => c.startsWith(name));
  return cookie ? cookie.slice(name.length) : null;
}

document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.playerId === "undefined" || typeof window.matchId === "undefined") {
    console.warn("⚠️ Not on battle page—exiting");
    return;
  }

  const playerId     = window.playerId;
  const yourName     = window.yourName;
  const matchId      = window.matchId;      // ← ensure matchId is pulled from window
  let   opponentId   = window.opponentId;
  let   opponentName = window.opponentName;
  let   isBotMatch   = window.isBotMatch;
  const csrftoken    = getCSRFToken();

  const deckApi        = `/game/api/battle-deck/${playerId}/`;
  const moveApi        = `/game/api/move/`;
  const matchStatusApi = `/game/api/match/${matchId}/`;   // now matchId is defined
  const battleBotApi   = `/game/api/battle-bot/`;

  const boardContainer = document.getElementById("game-board");
  const deckContainer  = document.getElementById("player-deck");
  const infoBar        = document.getElementById("player-turn");

  let currentTurn = null;   // ← declare currentTurn here so attemptMove() can read it

  const cellMap     = {};  // pos → cell element
  const cardMap     = {};  // player_card_id → deck-tile element
  const cardDataMap = {};  // player_card_id → full card data

  // 1) build our 3×3 grid
  function loadBoard() {
    boardContainer.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.index = i;
      cell.addEventListener("click", () => attemptMove(i));
      boardContainer.appendChild(cell);
      cellMap[i] = cell;
    }
  }

  // 2) helper to draw a card (deck or grid)
  function makeCard(card) {
    const wrapper = document.createElement("div");
    wrapper.className = "card";
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

  // 3) load your 7-card deck from the API
  function loadDeck() {
    deckContainer.innerHTML = "";
    fetch(deckApi, { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(json => {
        json.battle_deck.forEach(cd => {
          cardDataMap[cd.player_card_id] = cd;
          const el = makeCard(cd);
          cardMap[cd.player_card_id] = el;
          el.addEventListener("click", () => {
            Object.values(cardMap).forEach(c => c.classList.remove("selected"));
            if (!el.classList.contains("used")) el.classList.add("selected");
          });
          deckContainer.appendChild(el);
        });
        loadInitialState();
      })
      .catch(e => console.error("loadDeck error:", e));
  }

  /**
 * Central handler for flips, scores, turn‐text and game‐over banner.
 * Relies on:
 *   window.playerId       (your numeric player ID)
 *   window.yourName       (your username)
 *   window.opponentName   (e.g. "RamBot" or "Maxie")
 */
function handlePostMove(data) {
  // 1) Apply board flips
  if (Array.isArray(data.flips))     applyFlips(data.flips);
  if (Array.isArray(data.bot_flips)) applyFlips(data.bot_flips);

  // 2) Update the score display
  if (data.scores) updateScores(data.scores);

  // 3) Game-over?
if (data.game_over) {
  gameOver = true;
  const banner = document.getElementById("winner-banner");
  // data.winner is already the username string
  banner.textContent = `🏁 ${data.winner} wins!`;
  banner.style.display = "block";
  document.getElementById("battle-wrapper").classList.add("battle-over");
  return;
}


  // 4) Otherwise, hide banner and show whose turn it is
  document.getElementById("winner-banner").style.display = "none";
  const turnText = (data.current_turn_id === playerId)
    ? `Your turn, ${yourName}`
    : `${opponentName}'s turn`;
  document.getElementById("info-bar").textContent = turnText;

  // 5) Keep track of whose turn we just saw
  currentTurn = data.current_turn_id;
}

  /** 
   * Fetch full state and render **only new** moves + deck-tile usage 
   */
  function loadInitialState() {
    fetch(matchStatusApi, { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        // 1) detect 2P join
        if (!opponentId && data.player_two_id) {
          opponentId   = data.player_two_id;
          opponentName = data.player_two;
          isBotMatch   = data.player_two_is_bot;
          return location.reload();
        }

        // 2) draw only brand-new moves
        data.board.forEach(m => {
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
            const el = makeCard(cd);
            el.classList.add(
              "in-cell",
              m.player_id === playerId ? "my-card" : "opponent-card",
              "fade-in"
            );
            cell.appendChild(el);
          }
        });

        // 3) grey-out used deck tiles
        Object.values(cardMap).forEach(el => {
          const pcId = +el.dataset.pcId;
          const used = data.board.some(m => m.player_card_id === pcId);
          el.classList.toggle("used", used);
          el.classList.remove("selected");
        });

        // 4) delegate flips, turn, scores, game-over
        handlePostMove({
          flips:             data.flips     || [],
          bot_flips:         data.bot_flips || [],
          scores:            data.scores,
          game_over:         !data.is_active,
          winner:            data.winner,
          current_turn_id:   data.current_turn_id,
          current_turn_name: data.current_turn_name
        });
      })
      .catch(err => console.error("loadInitialState error:", err));
  }

  // flip‐animation + swap owner highlight
  function applyFlips(flips) {
    flips.forEach(fp => {
      const cell   = cellMap[fp];
      const cardEl = cell.querySelector(".card.in-cell");
      cell.classList.add("flipped");
      if (cardEl.classList.contains("my-card")) {
        cardEl.classList.replace("my-card","opponent-card");
      } else {
        cardEl.classList.replace("opponent-card","my-card");
      }
      setTimeout(() => cell.classList.remove("flipped"), 400);
    });
  }

  function updateScores(scores) {
    const bar = document.getElementById("score-bar");
    bar.textContent = Object.entries(scores)
      .map(([name,c]) => `${name}: ${c}`)
      .join(" — ");
  }

  // send your move & then re-load everything
  function attemptMove(pos) {
    if (gameOver) return;
    if (currentTurn !== playerId) {
      return alert("⏳ Hold on! It’s not your turn yet.");
    }
    const sel = document.querySelector(".card.selected");
    if (!sel) {
      return alert("Please select a card first.");
    }
    fetch(moveApi, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type":"application/json",
        "X-CSRFToken": csrftoken
      },
      body: JSON.stringify({
        match_id:  matchId,
        player_id: playerId,
        card_id:   +sel.dataset.pcId,
        position:  pos
      })
    })
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(() => setTimeout(loadInitialState, 200))
    .catch(err => console.error("attemptMove error:", err));
  }

  // have the bot play once, then re-run state loader
  function triggerBotPlay() {
    fetch(battleBotApi, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type":"application/json",
        "X-CSRFToken": csrftoken
      },
      body: JSON.stringify({ match_id: matchId })
    })
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => {
      if (data.bot_move) {
        const bm = data.bot_move;
        const el = makeCard(bm);
        el.classList.add(
          "in-cell",
          bm.player_id===playerId?"my-card":"opponent-card"
        );
        cellMap[bm.position].appendChild(el);
        const tile = cardMap[bm.player_card_id];
        if (tile) tile.classList.add("used");
      }
      handlePostMove(data);
    })
    .catch(err => console.error("triggerBotPlay error:", err));
  }

  // poll every 5s for new moves & joining opponent
  function pollLoop() {
    setInterval(loadInitialState, 5000);
  }

  // kick it all off
  loadBoard();
  loadDeck();
  pollLoop();
});
