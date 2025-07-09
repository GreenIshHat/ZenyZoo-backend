// static/game/js/deck.js

import { fetchJson } from "./utils.js";
import { makeCard } from "./ui.js";

/**
 * Fetches the 7 battle-deck cards and renders them into `container`.
 * Returns the array of card-data objects for later use.
 */
export async function initDeck({ playerId, container, onCardSelect }) {
  // 1) Fetch from your API
  const data = await fetchJson(`/game/api/battle-deck/${playerId}/`);
  
  // 2) Render each card into the container
  data.battle_deck.forEach(cd => {
    const el = makeCard({
      player_card_id:  cd.player_card_id,
      template_card_id: cd.template_card_id,
      card_name:       cd.name,
      image:           cd.image,
      stats:           cd.stats
    });
    // expose the id for grey-out
    el.dataset.pcId = cd.player_card_id;

    el.addEventListener("click", () => {
      onCardSelect(cd.player_card_id);
    });

    container.appendChild(el);
  });

  // 3) Return the raw array so controller can build its lookup
  return data.battle_deck;
}
