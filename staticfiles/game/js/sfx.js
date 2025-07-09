// static/game/js/sfx.js

// Preload audio assets
const bgAudio   = new Audio("/static/game/sfx/background.mp3");
const flipAudio = new Audio("/static/game/sfx/flip.ogg");
const placeAudio= new Audio("/static/game/sfx/play.ogg");
const botAudio  = new Audio("/static/game/sfx/play.ogg");
const winAudio  = new Audio("/static/game/sfx/win.ogg");

// Configure looping/background
bgAudio.loop   = true;
bgAudio.volume = 0.2;

export function playBackground() {
  bgAudio.play().catch(() => {});
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

export function fireConfetti() {
  if (typeof confetti !== "function") return;
  const duration     = 15_000;
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
