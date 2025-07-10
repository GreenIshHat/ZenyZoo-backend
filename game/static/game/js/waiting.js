// static/game/js/waiting.js

// 1) Grab the <ul id="your-matches"> list of YOUR matches
const yourMatchesList = document.getElementById('your-matches');
if (!yourMatchesList) {
  console.warn('waiting.js: #your-matches element not found');
} else {
  const socket = new WebSocket(
    (window.location.protocol === 'https:' ? 'wss' : 'ws')
    + '://' + window.location.host
    + '/ws/matches/'
  );

  socket.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.event === 'match_joined') {
      const { match_id, player_two } = msg.data;
      // only alert if it's one of *your* matches
      const li = document.getElementById(`match-${match_id}`);
      if (li) {
        alert(`⚡️ Player ${player_two} joined Match #${match_id}!`);
        li.querySelector('.status').textContent = 'Joined';
        // Redirect straight to the battle page:
        window.location.href = `/game/battle/${match_id}/`;
      }
    }
  };

  socket.onopen = () => console.log('[waiting.js] connected to /ws/matches/');
  socket.onclose = () => console.warn('[waiting.js] disconnected');
}
