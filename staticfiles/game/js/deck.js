// static/game/js/deck.js

import { fetchJson } from "./utils.js";
import { makeCard }    from "./ui.js";

/**
 * Fetch & render your 7-card deck.
 * @returns {Promise<Object.<number,object>>} player_card_id → cardData
 */
export async function initDeck({ playerId, container, onCardSelect }) {
  const url = `/game/api/battle-deck/${playerId}/`;
  const json = await fetchJson(url);

  const cardDataMap = {};
  container.innerHTML = "";

  json.battle_deck.forEach(cd => {
    cardDataMap[cd.player_card_id] = cd;
    const el = makeCard(cd);
    el.dataset.pcId = cd.player_card_id;

    el.addEventListener("click", () => {
      container.querySelectorAll(".card.selected")
               .forEach(c => c.classList.remove("selected"));
      if (!el.classList.contains("used")) {
        el.classList.add("selected");
        onCardSelect(cd.player_card_id);
      }
    });

    container.appendChild(el);
  });

  return cardDataMap;
}
