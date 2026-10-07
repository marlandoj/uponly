"use client";

import { useEffect, useRef } from "react";

const MAX_PARTICLES = 90;
const ORB_COUNT = 4;
const FRAME_MS = 1000 / 60;
const COLORS = ["0 229 255", "255 47 179", "125 255 42", "238 240 255"]; // cyan, magenta, lime, text

type Particle = { x: number; y: number; z: number; size: number; color: string; twinkle: number };
type Orb = { x: number; y: number; r: number; vx: number; vy: number; color: string };

/**
 * Fixed full-screen neon starfield + drifting glow orbs behind all content.
 * Decorative only: pointer-events none, aria-hidden. Under
 * prefers-reduced-motion the canvas stays empty and the CSS gradient on the
 * wrapper is the static fallback.
 */
export default function ArcadeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    let orbs: Orb[] = [];
    let raf = 0;
    let last = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const widthChanged = window.innerWidth !== w;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Mobile URL bars resize height on scroll; only reseed on real width changes.
      if (!widthChanged) return;
      // Fewer stars on small screens; capped for mobile GPUs.
      const count = Math.min(MAX_PARTICLES, Math.round((w * h) / 9000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: 0.2 + Math.random() * 0.8, // depth: nearer stars are bigger and faster
        size: 0.6 + Math.random() * 1.4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        twinkle: Math.random() * Math.PI * 2,
      }));
      orbs = Array.from({ length: ORB_COUNT }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.max(w, h) * (0.25 + Math.random() * 0.15),
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        color: i % 2 ? COLORS[1] : COLORS[0],
      }));
    };

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      const dt = t - last;
      if (dt < FRAME_MS - 1) return; // cap at 60fps on high-refresh screens
      const step = Math.min(dt, 100) / FRAME_MS; // don't jump after a stall
      last = t;

      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);

      ctx.globalCompositeOperation = "lighter";
      for (const o of orbs) {
        o.x += o.vx * step;
        o.y += o.vy * step;
        if (o.x < -o.r * 0.5 || o.x > w + o.r * 0.5) o.vx *= -1;
        if (o.y < -o.r * 0.5 || o.y > h + o.r * 0.5) o.vy *= -1;
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, `rgb(${o.color} / 0.12)`);
        g.addColorStop(1, `rgb(${o.color} / 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
      }

      for (const p of particles) {
        // Parallax: drift up and slightly sideways, speed scaled by depth.
        p.y -= 0.35 * p.z * step;
        p.x += 0.08 * p.z * step;
        if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
        if (p.x > w + 4) p.x = -4;
        p.twinkle += 0.03 * step;
        const alpha = (0.35 + 0.45 * p.z) * (0.7 + 0.3 * Math.sin(p.twinkle));
        const s = p.size * p.z * 2;
        ctx.fillStyle = `rgb(${p.color} / ${alpha.toFixed(3)})`;
        ctx.fillRect(p.x, p.y, s, s); // square stars keep the pixel look
      }
    };

    const start = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ctx.clearRect(0, 0, w, h);
      if (motion.matches || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(draw);
    };

    const onResize = () => {
      resize();
      start();
    };

    resize();
    start();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", start);
    motion.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", start);
      motion.removeEventListener("change", start);
    };
  }, []);

  return (
    <div className="arcade-bg" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
