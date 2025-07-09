// static/game/js/moves.js
import { fetchJson, getCSRFToken } from "./utils.js";

/**
 * Send the human’s move to the backend.
 * @param {{matchId: number, playerId: number, cardId: number, position: number}} opts
 * @returns {Promise<Object>} the updated match state
 */
export async function playMove({ matchId, playerId, cardId, position }) {
  const csrftoken = getCSRFToken();
  return fetchJson("/game/api/move/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrftoken
    },
    body: JSON.stringify({
      match_id:  matchId,
      player_id: playerId,
      card_id:   cardId,
      position
    })
  });
}

/**
 * Tell the bot to play its turn.
 * @param {{matchId: number}} opts
 * @returns {Promise<Object>} the updated match state
 */
export async function playBot({ matchId }) {
  const csrftoken = getCSRFToken();
  return fetchJson("/game/api/battle-bot/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrftoken
    },
    body: JSON.stringify({ match_id: matchId })
  });
}
