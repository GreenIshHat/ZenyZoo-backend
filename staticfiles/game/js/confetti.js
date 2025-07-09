// static/game/js/confetti.js
// Assumes you’ve included canvas-confetti via <script> or npm.
// If you loaded it as `confetti` global, then:
export default function runConfetti() {
  const duration     = 15 * 1000;
  const endTime      = Date.now() + duration;
  const defaults     = { startVelocity:30, spread:360, ticks:60, zIndex:9999 };

  (function frame() {
    const timeLeft = endTime - Date.now();
    if (timeLeft <= 0) return;
    const count = 50 * (timeLeft / duration);
    confetti({ ...defaults, particleCount: count, origin:{ x:Math.random()*0.3, y:Math.random()-0.2 } });
    confetti({ ...defaults, particleCount: count, origin:{ x:Math.random()*0.3+0.7, y:Math.random()-0.2 } });
    requestAnimationFrame(frame);
  })();
}


