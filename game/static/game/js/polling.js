// static/game/js/polling.js

import { fetchJson } from "./utils.js";

/**
 * Start both the “human vs human” polling and the turn-indicator polling.
 *
 * @param {Object} opts
 * @param {string} opts.statusUrl      – e.g. `/game/api/match/123/`
 * @param {string} opts.stateUrl       – e.g. `/game/api/match/123/state/`
 * @param {number} opts.playerId       – your player ID
 * @param {Function} opts.onJoin       – called once when P2 truly joins
 * @param {Function} opts.onOppMove    – called whenever it becomes your turn
 * @param {Function} opts.onUpdateTurn – called every tick with full state payload
 * @param {Object} [intervals]
 * @param {number} [intervals.humInterval=5000]
 * @param {number} [intervals.turnInterval=2000]
 * @returns {Function} stopPolling()   – call to cancel both intervals
 */
export function startMatchPolling({
  statusUrl,
  stateUrl,
  playerId,
  onJoin,
  onOppMove,
  onUpdateTurn
}, { humInterval = 5000, turnInterval = 2000 } = {}) {
  let sawJoin = false;
  let errorCount = 0;
  const MAX_ERRORS = 3;

  // 1) Poll for opponent & opponent’s moves
  const humPoll = setInterval(async () => {
    try {
      const data = await fetchJson(statusUrl);
      errorCount = 0;

      // Only fire onJoin when a NEW opponent appears
      if (!sawJoin && data.player_two_id) {
        sawJoin = true;
        onJoin(data);
      }

      // Fire onOppMove when it becomes YOUR turn
      if (data.current_turn_id === playerId && !data.game_over) {
        onOppMove(data);
      }
    } catch (e) {
      if (++errorCount >= MAX_ERRORS) {
        console.error("Too many polling errors, stopping humPoll:", e);
        clearInterval(humPoll);
      } else {
        console.error("pollHumanMatch error:", e);
      }
    }
  }, humInterval);

  // 2) Poll for turn‐indicator updates
  const turnPoll = setInterval(async () => {
    try {
      const data = await fetchJson(stateUrl);
      errorCount = 0;

      onUpdateTurn(data);
      if (!data.is_active) {
        clearInterval(turnPoll);
      }
    } catch (e) {
      if (++errorCount >= MAX_ERRORS) {
        console.error("Too many polling errors, stopping turnPoll:", e);
        clearInterval(turnPoll);
      } else {
        console.error("turn-poll error:", e);
      }
    }
  }, turnInterval);

  // 3) Initial bootstrap: seed sawJoin & update turn once
  (async () => {
    try {
      // figure out if an opponent was already there
      const initStatus = await fetchJson(statusUrl);
      sawJoin = !!initStatus.player_two_id;

      // initial turn display
      const initState = await fetchJson(stateUrl);
      onUpdateTurn(initState);
    } catch (e) {
      console.error("initial polling error:", e);
    }
  })();

  // Return a cancel function
  return () => {
    clearInterval(humPoll);
    clearInterval(turnPoll);
  };
}
