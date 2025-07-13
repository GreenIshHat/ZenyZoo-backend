// static/game/js/waiting.js

const yourMatchesList = document.getElementById('your-matches'); // null on battle view
const openMatchesList = document.getElementById('matches-row');  // null on battle view

const wsScheme = location.protocol === 'https:' ? 'wss' : 'ws';
const socket = new WebSocket(`${wsScheme}://${location.host}/ws/matches/`);

socket.onopen = () =>
  console.log('[waiting.js] connected to /ws/matches/');
socket.onclose = () =>
  console.warn('[waiting.js] disconnected from /ws/matches/');

socket.onmessage = ({ data }) => {
  let msg;
  try { msg = JSON.parse(data); } catch (e) { return; }

  // Someone joined a match
  if (msg.event === 'match_joined') {
    const { match_id, player_two } = msg.data;

    // If you’re waiting for this match, alert + redirect!
    // Use window.matchId from your battle page context
    if (window.matchId && Number(match_id) === Number(window.matchId)) {
      alert(`⚡️ Player ${player_two} joined Match #${match_id}!`);
      location.reload(); // reloads page to load the actual battle
      // OR: location.href = `/game/battle/${match_id}/`; // explicit, but reload is simpler
      return;
    }

    // ... (Optional: update match lists if present)
    if (openMatchesList) {
      openMatchesList.querySelectorAll('.match-item').forEach(li => {
        const a = li.querySelector(`a[href$="/${match_id}/"]`);
        if (a) li.remove();
      });
    }
    if (yourMatchesList) {
      const myLi = document.getElementById(`match-${match_id}`);
      if (myLi) myLi.querySelector('.status').textContent = 'Joined';
    }
  }

  // New match created (match list view only)
  if (msg.event === 'match_created' && openMatchesList) {
    const { id, player_one } = msg.data;
    const li = document.createElement('li');
    li.className = 'match-item';
    li.innerHTML = `
      <span>
        Match #${id} – Host: ${player_one}
        <a href="/game/battle/${id}/">Join as Player</a>
        <small>(just now)</small>
      </span>`;
    openMatchesList.appendChild(li);
  }
};
