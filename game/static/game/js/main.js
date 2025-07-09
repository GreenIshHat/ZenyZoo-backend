// main.js
import { GameController } from "./controller.js";

window.addEventListener("DOMContentLoaded", () => {
  if (typeof window.playerId === "undefined") return;

  new GameController({
    boardEl:      document.getElementById("game-board"),
    handEl:       document.getElementById("player-deck"),
    scoreBar:     document.getElementById("score-bar"),
    banner:       document.getElementById("winner-banner"),
    playerTurnEl: document.getElementById("player-turn"),
    timerEl:      document.getElementById("timer-display"),

    statusUrl:  `/game/api/match/${window.matchId}/`,
    stateUrl:   `/game/api/match/${window.matchId}/state/`,
    makeMoveUrl:`/game/api/move/`,      // adjust to your actual POST endpoint

    playerId:   window.playerId,
    matchId:    window.matchId,
    opponentId: window.opponentId,
    isBotMatch: window.isBotMatch,
  });
});
