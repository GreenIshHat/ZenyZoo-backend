document.addEventListener("DOMContentLoaded", () => {
  const board = document.getElementById("game-board");
  const deck = document.getElementById("player-deck");
  const infoBar = document.getElementById("player-turn");

  const deckApi = `/game/battle-deck/${playerId}/`;
  const moveApi = `/game/move/`;
  const matchStatusApi = `/game/match-status/${matchId}/`;

  let currentTurn = null;

  const cellMap = {};  // index -> cell
  const cardMap = {};  // id -> element

  function loadBoard() {
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.index = i;
      cell.onclick = () => attemptMove(i);
      board.appendChild(cell);
      cellMap[i] = cell;
    }
  }

  function loadDeck() {
    fetch(deckApi)
      .then(res => res.json())
      .then(data => {
        data.battle_deck.forEach(card => {
          const cardEl = document.createElement("div");
          cardEl.className = "card";
          cardEl.style.backgroundImage = `url(${card.image})`;
          cardEl.dataset.cardId = card.card_id;
          cardEl.title = card.name;
          cardMap[card.card_id] = cardEl;

          cardEl.onclick = () => {
            document.querySelectorAll(".card").forEach(c => c.classList.remove("selected"));
            cardEl.classList.add("selected");
          };

          deck.appendChild(cardEl);
        });
      });
  }

  function attemptMove(position) {
    const cardEl = document.querySelector(".card.selected");
    if (!cardEl || currentTurn !== playerId) return;

    const cardId = parseInt(cardEl.dataset.cardId);
    fetch(moveApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: matchId, player_id: playerId, card_id: cardId, position })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
        return;
      }

      const cell = cellMap[position];
      cell.classList.add("filled");
      cell.style.backgroundImage = cardEl.style.backgroundImage;

      cardEl.classList.add("used");
      cardEl.classList.remove("selected");

      if (data.flips) {
        data.flips.forEach(flipPos => {
          const flipped = cellMap[flipPos];
          flipped.classList.add("flipped");
        });
      }

      if (data.game_over) {
        alert(`Game Over. Winner: ${data.winner}`);
      } else {
        currentTurn = data.next_turn_id;
        infoBar.textContent = `Current turn: Player ${data.next_turn}`;
      }
    });
  }

  function pollTurn() {
    setInterval(() => {
      fetch(matchStatusApi)
        .then(res => res.json())
        .then(data => {
          currentTurn = data.current_turn_id;
          infoBar.textContent = `Current turn: ${data.current_turn_name}`;
        });
    }, 3000);
  }

  loadBoard();
  loadDeck();
  pollTurn();
});

