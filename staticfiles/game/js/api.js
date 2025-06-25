// static/game/js/api.js

import { getCSRFToken, fetchJson } from "./utils.js";


/**
 * Load the 7-card battle deck and render into the container.
 */
export function loadDeck(url, container, makeCard, cardMap, cardDataMap, onDone) {
  container.innerHTML = '';
  fetchJson(url)
    .then(json => {
      json.battle_deck.forEach(cd => {
        cardDataMap[cd.player_card_id] = cd;
        const el = makeCard(cd);
        cardMap[cd.player_card_id] = el;
        el.addEventListener('click', () => {
          Object.values(cardMap).forEach(c => c.classList.remove('selected'));
          if (!el.classList.contains('used')) el.classList.add('selected');
        });
        container.appendChild(el);
      });
      onDone();
    })
    .catch(e => console.error('loadDeck error:', e));
}

/**
 * Fetch the full match state once.
 */
export function loadInitialState(url, handlers) {
  fetchJson(url)
    .then(data => {
      if (handlers.onResult) handlers.onResult(data);
    })
    .catch(e => console.error('loadInitialState error:', e));
}





/**
 * Send the human move to the backend.
 * handlers = { onResult: fn(data) }
 */
export function attemptMove(url, payload, handlers) {
  fetchJson(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken':  getCSRFToken()
    },
    body: JSON.stringify(payload)
  })
  .then(data => {
    if (handlers.onResult) handlers.onResult(data);
  })
  .catch(e => console.error('attemptMove error:', e));
}

/** Let the bot play via the dedicated endpoint */
export function triggerBotPlay(url, payload, handlers) {
  fetchJson(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken':  getCSRFToken()
    },
    body: JSON.stringify(payload)
  })
  .then(data => {
    if (handlers.onResult) handlers.onResult(data);
  })
  .catch(e => console.error('triggerBotPlay error:', e));
}

/** Quick polling for human vs human */
export function pollHumanMatch(url, handlers) {
  setInterval(() => {
    fetchJson(url)
      .then(data => {
        if (!handlers.opponentId && data.player_two_id) {
          handlers.onJoin(data);
        }
        if (data.current_turn_id === handlers.playerId && !data.game_over) {
          handlers.onOppMove(data);
        }
      })
      .catch(e => console.error('pollHumanMatch error:', e));
  }, 5000);
}