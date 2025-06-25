// static/game/js/ui.js

/**
 * Dibuja una cuadrícula 3×3 y asigna el callback onCellClick a cada celda.
 * @param {HTMLElement} container  el nodo donde se mete el tablero
 * @param {(pos:number)=>void} onCellClick 
 */
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

/**
 * Crea el DOM de una carta (deck o en el tablero) a partir de sus datos.
 * @param {object} card  Debe incluir image, player_card_id, stats…
 * @returns {HTMLElement}
 */
export function makeCard(card) {
  const wrapper = document.createElement("div");
  wrapper.className = "card";

  if (card.player_card_id != null) {
    wrapper.dataset.pcId = card.player_card_id;
  }

  wrapper.title = card.card_name || card.name;
  wrapper.innerHTML = `
    <div class="card-face" 
         style="background-image:url('${card.image}')"></div>
    <span class="stat stat-top">${card.card_top ?? card.stats.top}</span>
    <span class="stat stat-right">${card.card_right ?? card.stats.right}</span>
    <span class="stat stat-bottom">${card.card_bottom ?? card.stats.bottom}</span>
    <span class="stat stat-left">${card.card_left ?? card.stats.left}</span>
  `;
  return wrapper;
}

/**
 * Anima y aplica el flip de un array de posiciones (celdas).
 * @param {Object.<number,HTMLElement>} cellMap  mapeo posición→celda
 * @param {number[]} flips  posiciones a “voltear”
 */
export function applyFlips(cellMap, flips) {
  flips.forEach(pos => {
    const cell = cellMap[pos];
    cell.classList.add("flipped");
    const cardEl = cell.querySelector(".card.in-cell");
    if (cardEl) {
      if (cardEl.classList.contains("my-card")) {
        cardEl.classList.replace("my-card","opponent-card");
      } else {
        cardEl.classList.replace("opponent-card","my-card");
      }
    }
    setTimeout(() => cell.classList.remove("flipped"), 400);
  });
}

/**
 * Draws the current scores into the given DOM element.
 * @param {HTMLElement} containerEl  Where to render "Alice: 3 — Bob: 2"
 * @param {{ [username: string]: number }} scores
 */
export function updateScores(containerEl, scores) {
  if (!containerEl || typeof scores !== 'object') return;
  containerEl.textContent = Object.entries(scores)
    .map(([name, count]) => `${name}: ${count}`)
    .join(" — ");
}