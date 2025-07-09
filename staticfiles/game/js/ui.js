// static/game/js/ui.js

export function loadBoard(container, onCellClick) {
  container.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.index = i;
    cell.addEventListener("click", () => onCellClick(i));
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

export function applyFlips(cellMap, flips) {
  flips.forEach(pos => {
    const cell = cellMap[pos];
    cell.classList.add("flipped");
    const cardEl = cell.querySelector(".card.in-cell");
    if (cardEl) {
      cardEl.classList.toggle("my-card");
      cardEl.classList.toggle("opponent-card");
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
