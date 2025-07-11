// match_chat.js

(function() {
  const chatContainer = document.getElementById('battle-chat');
  // Read the match id from the data attribute
  const matchId = chatContainer.dataset.matchId;
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  const chatSocket = new WebSocket(protocol + window.location.host + `/ws/chat/match/${matchId}/`);
  const chatLog    = document.getElementById('chat-log-match');
  const chatInput  = document.getElementById('chat-message-input-match');
  const chatSend   = document.getElementById('chat-send-btn-match');

  chatSocket.onopen = () => console.log('Match Chat WS connected');
  chatSocket.onerror = err => console.error('Chat WS error:', err);

  chatSocket.onmessage = function(e) {
    const data = JSON.parse(e.data);
    let line = '';

    switch (data.event) {
      case 'join':
        line = `<div class="chat-notice"><em>${data.username} joined the chat.</em></div>`;
        break;
      case 'leave':
        line = `<div class="chat-notice"><em>${data.username} left the chat.</em></div>`;
        break;
      case 'message':
      default:
        line = `<div><strong>${data.username}:</strong> ${data.message}</div>`;
    }

    chatLog.insertAdjacentHTML('beforeend', line);
    chatLog.scrollTop = chatLog.scrollHeight;
  };

  chatSocket.onclose = () => {
    chatLog.insertAdjacentHTML('beforeend',
      '<div class="chat-notice"><em>Disconnected from chat.</em></div>');
  };

  chatSend.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChat();
  });

  function sendChat() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    chatSocket.send(JSON.stringify({ message: msg }));
    chatInput.value = '';
  }
})();
