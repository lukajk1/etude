import { playNotes } from "../audio/live";

/**
 * A pass: a burst of confetti from both lower corners and a short rising chime on piano.
 * It runs even with reduced motion set: it was asked for, and it's brief.
 */

const COLORS = ["#8f6b26", "#c9a24a", "#b5523b", "#4f7a5a", "#3f6386", "#d8b98a", "#7a4e6e"];

// C E G C', then the chord held.
const CHIME = [
  { pitches: [72], at: 0, dur: 0.18, vel: 0.55 },
  { pitches: [76], at: 0.09, dur: 0.18, vel: 0.55 },
  { pitches: [79], at: 0.18, dur: 0.18, vel: 0.6 },
  { pitches: [84], at: 0.27, dur: 0.5, vel: 0.65 },
  { pitches: [72, 76, 79, 84], at: 0.45, dur: 1.1, vel: 0.45 },
];

export function celebrate() {
  void playNotes(CHIME);
  confetti();
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  angle: number;
  spin: number;
  flip: number;
  color: string;
}

function confetti() {
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const pieces: Piece[] = [];
  for (let i = 0; i < 160; i++) {
    const left = i % 2 === 0;
    // Thrown up and inward from a lower corner.
    const angle = (left ? -1 : -Math.PI + 1) + (Math.random() - 0.5) * 0.7 - (left ? 0.15 : -0.15);
    const speed = 11 + Math.random() * 9;
    pieces.push({
      x: left ? -10 : W + 10,
      y: H * 0.85,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      w: 6 + Math.random() * 5,
      h: 9 + Math.random() * 7,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.3,
      flip: Math.random() * Math.PI * 2,
      color: COLORS[i % COLORS.length],
    });
  }

  const start = performance.now();
  let last = start;
  const frame = (now: number) => {
    const dt = Math.min(2, (now - last) / 16.7);
    last = now;
    const t = now - start;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = t > 2600 ? Math.max(0, 1 - (t - 2600) / 900) : 1;
    for (const p of pieces) {
      p.vy += 0.32 * dt;
      p.vx *= 0.985 ** dt;
      p.vy *= 0.985 ** dt;
      p.x += p.vx * dt + Math.sin(p.flip) * 0.6;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.flip += 0.12 * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      // Squash one axis to look like a paper square turning over.
      ctx.scale(1, Math.cos(p.flip));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < 3500) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
