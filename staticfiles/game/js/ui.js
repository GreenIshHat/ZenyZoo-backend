// static/game/js/ui.js

export function loadBoard(container, onCellClick) {
  container.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.position = i;
    // pass the real MouseEvent back up so controller can read `evt.currentTarget.dataset.position`
    cell.addEventListener("click", onCellClick);
    container.appendChild(cell);
  }
}

export function makeCard(card) {
  const wrapper = document.createElement("div");
  wrapper.className = "card";
  if (card.player_card_id != null) wrapper.dataset.pcId = card.player_card_id;

  const top    = card.card_top    ?? card.stats?.top    ?? "";
  const right  = card.card_right  ?? card.stats?.right  ?? "";
  const bottom = card.card_bottom ?? card.stats?.bottom ?? "";
  const left   = card.card_left   ?? card.stats?.left   ?? "";

  wrapper.title = card.card_name ?? card.name ?? "";

  wrapper.innerHTML = `
    <div class="card-face" style="background-image:url('${card.image}')"></div>
    <span class="stat stat-top">${top}</span>
    <span class="stat stat-right">${right}</span>
    <span class="stat stat-bottom">${bottom}</span>
    <span class="stat stat-left">${left}</span>
  `;
  return wrapper;
}

// flips = [{ position: ..., owner_id: ... }, ...]
export function applyFlips(cellMap, flips, playerId) {
  flips.forEach(({position, owner_id}) => {
    const cell = cellMap[position];
    cell.classList.add("flipped");
    const cardEl = cell.querySelector(".card.in-cell");
    if (cardEl) {
      cardEl.classList.remove("my-card", "opponent-card");
      cardEl.classList.add(owner_id === playerId ? "my-card" : "opponent-card");
    }
    setTimeout(() => cell.classList.remove("flipped"), 400);
  });
}


export function updateScores(container, scores) {
  if (!container || typeof scores !== "object") return;
  container.textContent = Object.entries(scores)
    .map(([n,c]) => `${n}: ${c}`)
    .join(" — ");
}


export function greyOutCardElement(playerCardId) {
  const deck = document.getElementById("player-deck");
  if (!deck) return;
  const cardEl = deck.querySelector(`.card[data-pc-id='${playerCardId}']`);
  if (!cardEl) return;
  cardEl.classList.add("used");
  cardEl.disabled = true;
  cardEl.style.pointerEvents = 'none';
}