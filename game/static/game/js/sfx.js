// static/game/js/sfx.js

// Preload audio assets
// old routes : ("/static/game/sfx/background.mp3");
// fallback to same-origin if CDN_URL isn’t defined
const BASE = window.CDN_URL || "https://zeny-zoo-assets.pages.dev/cloud_statics";

export const bgAudio    = new Audio(`${BASE}/sfx/background.mp3`);
export const flipAudio  = new Audio(`${BASE}/sfx/flip.ogg`);
export const placeAudio = new Audio(`${BASE}/sfx/play.ogg`);
export const botAudio   = new Audio(`${BASE}/sfx/play.ogg`);   // bot.ogg if you have a separate bot sound
export const winAudio   = new Audio(`${BASE}/sfx/win.ogg`);
export const loseAudio  = new Audio(`${BASE}/sfx/lose.ogg`);

let _bgAudio = null;

export function playBackground() {
  if (_bgAudio) return;
  _bgAudio = new Audio("/static/game/sfx/background.mp3");
  _bgAudio.loop   = true;
  _bgAudio.volume = 0.3;
  _bgAudio.play().catch(()=>{});
}

export function stopBackground() {
  if (!_bgAudio) return;
  _bgAudio.pause();
  _bgAudio.currentTime = 0;
  _bgAudio = null;
}

export function playFlip() {
  flipAudio.currentTime = 0;
  flipAudio.play().catch(() => {});
}

export function playPlace() {
  placeAudio.currentTime = 0;
  placeAudio.play().catch(() => {});
}

export function playBot() {
  botAudio.currentTime = 0;
  botAudio.play().catch(() => {});
}

export function playWin() {
  winAudio.currentTime = 0;
  winAudio.play().catch(() => {});
}

export function playLose() {
  loseAudio.currentTime = 0;
  loseAudio.play().catch(() => {});
}

export function fireConfetti() {
  if (typeof confetti !== "function") return;
  const duration     = 3_000;
  const animationEnd = Date.now() + duration;
  const defaults     = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

  (function frame() {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return;
    const particleCount = 50 * (timeLeft / duration);
    confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.3, y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.3 + 0.7, y: Math.random() - 0.2 } });
    requestAnimationFrame(frame);
  })();
}
