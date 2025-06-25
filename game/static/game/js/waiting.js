// static/game/js/waiting.js

import { getCSRFToken, fetchJson } from "./utils.js";

window.addEventListener("DOMContentLoaded", () => {
  // Expect window.matchId set in template
  if (typeof window.matchId === "undefined") return;
  const statusApi = `/game/api/match/${window.matchId}/`;

  const poll = setInterval(() => {
    fetchJson(statusApi)
      .then(data => {
        if (data.player_two_id) {
          alert("🎉 Someone just joined your match! Redirecting…");
          clearInterval(poll);
          window.location.href = `/game/battle/${window.matchId}/`;
        }
      })
      .catch(console.error);
  }, 5000);
});
