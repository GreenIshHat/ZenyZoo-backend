// polling.js
import { fetchJson } from "./utils.js";

export function startMatchPolling(
  { statusUrl, stateUrl, playerId, onJoin, onOppMove, onUpdateTurn },
  { humInterval = 5000, turnInterval = 2000 } = {}
) {
  let sawJoin = false;
  let errorCount = 0;
  const MAX_ERRORS = 3;

  // 1) Poll to detect when opponent joins & when it becomes your turn
  const humPoll = setInterval(async () => {
    try {
      const data = await fetchJson(statusUrl);
      errorCount = 0;

      // fire onJoin once when player two appears
      if (!sawJoin && data.player_two_id) {
        sawJoin = true;
        onJoin(data);
      }

      // fire onOppMove when it becomes YOUR turn
      if (data.current_turn_id === playerId && !data.game_over) {
        onOppMove(data);
      }

      // stop everything if game ended
      if (data.game_over) {
        clearInterval(humPoll);
        clearInterval(turnPoll);
      }
    } catch (e) {
      if (++errorCount >= MAX_ERRORS) {
        console.error("humPoll error limit reached, stopping.", e);
        clearInterval(humPoll);
        clearInterval(turnPoll);
      } else {
        console.error("humPoll error:", e);
      }
    }
  }, humInterval);

  // 2) Poll to update turn-indicator (and show “Game over” when done)
  const turnPoll = setInterval(async () => {
    try {
      const data = await fetchJson(stateUrl);
      errorCount = 0;

      onUpdateTurn(data);

      if (data.game_over) {
        clearInterval(humPoll);
        clearInterval(turnPoll);
      }
    } catch (e) {
      if (++errorCount >= MAX_ERRORS) {
        console.error("turnPoll error limit reached, stopping.", e);
        clearInterval(humPoll);
        clearInterval(turnPoll);
      } else {
        console.error("turnPoll error:", e);
      }
    }
  }, turnInterval);

  // 3) Initial fetch to bootstrap UI
  (async () => {
    try {
      const initStatus = await fetchJson(statusUrl);
      sawJoin = !!initStatus.player_two_id;
      const initState = await fetchJson(stateUrl);
      onUpdateTurn(initState);
    } catch (e) {
      console.error("initial polling error:", e);
    }
  })();

  // return a cleanup fn so caller can stop both polls
  return () => {
    clearInterval(humPoll);
    clearInterval(turnPoll);
  };
}
