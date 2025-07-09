import { GameController } from "./controller.js";

window.addEventListener("DOMContentLoaded", () => {
  if (typeof window.playerId === "undefined") return;
  new GameController({
    playerId:   window.playerId,
    matchId:    window.matchId,
    opponentId: window.opponentId,
    isBotMatch: window.isBotMatch,
  });
});
