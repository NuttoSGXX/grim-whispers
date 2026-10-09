// Grim Sanity: one shared animation loop, and a full-screen particle field for the duel.

/** A single requestAnimationFrame loop for dice and particles. */
export const Loop = {
  items: new Set(), raf: 0, last: 0,
  add(o) { this.items.add(o); if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame((t) => this.step(t)); } },
  remove(o) { this.items.delete(o); },
  step(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    for (const o of [...this.items]) { try { o.tick(dt, t / 1000); } catch (e) { console.warn("grim-sanity | fx", e); this.items.delete(o); } }
    this.raf = this.items.size ? requestAnimationFrame((n) => this.step(n)) : 0;
  }
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Units are CSS pixels; `s` is the size of one die, so bursts scale with the layout.
const KINDS = {
  // slow ash that drifts across the whole screen
  ash: (p, w, h) => {
    p.x = rand(0, w); p.y = rand(-20, h); p.vx = rand(-8, 8); p.vy = rand(6, 22); p.g = 0; p.drag = 0;
    p.life = p.max = rand(5, 11); p.size = rand(0.8, 2.2); p.sway = rand(0.4, 1.4); p.tw = rand(0.5, 2);
    p.col = Math.random() < 0.18 ? [200, 30, 30] : pick([[90, 84, 80], [52, 46, 46], [130, 120, 110]]); p.a = rand(0.25, 0.7);
  },
  // bone shards from a cracking Sanity Die
  shard: (p, w, h, x, y, s) => {
    const a = rand(0, Math.PI * 2), sp = rand(0.8, 3.6) * s;
    p.x = x + Math.cos(a) * s * 0.2; p.y = y + Math.sin(a) * s * 0.2; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - s * 1.4;
    p.g = s * 9; p.drag = 1.1; p.life = p.max = rand(0.6, 1.4); p.size = rand(0.04, 0.11) * s; p.rot = rand(0, 6); p.vr = rand(-12, 12); p.tri = true;
    p.col = pick([[236, 226, 204], [190, 176, 150], [120, 30, 30], [60, 54, 50]]); p.a = 1;
  },
  // red sparks where the dark wins
  ember: (p, w, h, x, y, s) => {
    const a = rand(0, Math.PI * 2), sp = rand(0.4, 2.6) * s;
    p.x = x; p.y = y; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - s * 0.6; p.g = -s * 0.6; p.drag = 1.8;
    p.life = p.max = rand(0.5, 1.5); p.size = rand(0.015, 0.045) * s; p.tw = rand(8, 16); p.glow = [255, 40, 30];
    p.col = pick([[255, 70, 50], [255, 150, 90], [200, 20, 30]]); p.a = 1; p.add = true;
  },
  // pale gold where the player holds
  gold: (p, w, h, x, y, s) => {
    const a = rand(0, Math.PI * 2), sp = rand(0.3, 2.2) * s;
    p.x = x; p.y = y; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.g = s * 0.9; p.drag = 2.2;
    p.life = p.max = rand(0.6, 1.6); p.size = rand(0.015, 0.04) * s; p.tw = rand(8, 16); p.star = Math.random() < 0.3;
    p.col = pick([[255, 250, 225], [255, 214, 110], [240, 170, 50]]); p.a = 1; p.add = true;
  },
  // violet fire for the unhinged
  violet: (p, w, h, x, y, s) => {
    p.x = x + rand(-0.6, 0.6) * s; p.y = y + rand(-0.2, 0.5) * s; p.vx = rand(-0.2, 0.2) * s; p.vy = -rand(0.6, 2.4) * s; p.g = -s * 0.4; p.drag = 0.6;
    p.life = p.max = rand(0.7, 1.9); p.size = rand(0.03, 0.09) * s; p.tw = rand(5, 12); p.sway = rand(2, 5); p.glow = [170, 60, 255];
    p.col = pick([[200, 120, 255], [150, 60, 240], [255, 200, 255], [110, 30, 200]]); p.a = 0.9; p.add = true;
  },
  // a low, steady flicker under an Insanity Die; kept small so the number stays readable
  wisp: (p, w, h, x, y, s) => {
    p.x = x + rand(-0.42, 0.42) * s; p.y = y + rand(0.05, 0.2) * s; p.vx = rand(-0.1, 0.1) * s; p.vy = -rand(0.25, 0.8) * s; p.g = -s * 0.2; p.drag = 0.8;
    p.life = p.max = rand(0.5, 1.1); p.size = rand(0.014, 0.036) * s; p.tw = rand(5, 12); p.sway = rand(2, 5);
    p.col = pick([[200, 120, 255], [150, 60, 240], [255, 200, 255]]); p.a = 0.8; p.add = true;
  },
  // dark smoke where a Trauma Die is beaten
  smoke: (p, w, h, x, y, s) => {
    const a = rand(0, Math.PI * 2);
    p.x = x + Math.cos(a) * s * 0.2; p.y = y + Math.sin(a) * s * 0.2; p.vx = Math.cos(a) * s * 0.5; p.vy = -rand(0.2, 1) * s; p.g = -s * 0.2; p.drag = 0.8;
    p.life = p.max = rand(0.8, 1.8); p.size = rand(0.12, 0.3) * s; p.grow = s * 0.25; p.col = pick([[30, 24, 26], [60, 20, 24], [18, 14, 16]]); p.a = 0.45; p.soft = true;
  }
};

export class Field {
  constructor(canvas, { low = false } = {}) {
    this.el = canvas; this.ctx = canvas.getContext("2d"); this.parts = []; this.low = low; this.w = 0; this.h = 0; this.acc = 0;
    this.ambient = low ? 0 : 14; this.flames = [];
    this.resize = () => {
      // particles are soft dots, so the canvas stays at 1x: a 4K or retina screen would only cost frame time
      const r = 1;
      this.w = canvas.clientWidth || window.innerWidth; this.h = canvas.clientHeight || window.innerHeight; this.r = r;
      canvas.width = Math.round(this.w * r); canvas.height = Math.round(this.h * r);
    };
    window.addEventListener("resize", this.resize);
    this.resize();
    if (!low) for (let i = 0; i < 60; i++) this.spawn("ash");
    Loop.add(this);
  }

  spawn(kind, x, y, s) { const p = {}; KINDS[kind]?.(p, this.w, this.h, x, y, s); this.parts.push(p); }

  /** A one-off burst at screen position (x, y); `s` is the die size in pixels. */
  burst(kind, x, y, s = 60, count = 30) {
    const n = this.low ? Math.ceil(count / 4) : count;
    for (let i = 0; i < n && this.parts.length < 900; i++) this.spawn(kind, x, y, s);
  }

  /** A burst at the centre of an element. */
  at(el, kind, count) {
    if (!el?.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    if (r.width) this.burst(kind, r.left + r.width / 2, r.top + r.height / 2, Math.max(28, r.width), count);
  }

  /** Keep a flame burning on an element until the field is destroyed. */
  flame(el, kind = "wisp", rate = 12) { if (!this.low) this.flames.push({ el, kind, rate, acc: 0 }); }

  tick(dt, now) {
    const { ctx } = this; if (!this.w) return;
    this.acc += this.ambient * dt;
    while (this.acc >= 1) { this.acc--; if (this.parts.length < 700) { this.spawn("ash"); this.parts[this.parts.length - 1].y = -10; } }
    for (const f of this.flames) {
      if (!f.el.isConnected || this.hold) continue;
      const r = f.el.getBoundingClientRect(); f.acc += f.rate * dt;
      while (f.acc >= 1) { f.acc--; if (this.parts.length < 800) this.spawn(f.kind, r.left + r.width / 2, r.top + r.height * 0.72, r.width); }
    }
    ctx.setTransform(this.r, 0, 0, this.r, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0 || p.y > this.h + 40) { this.parts.splice(i, 1); continue; }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.g * dt;
      p.x += (p.vx + (p.sway ? Math.sin(now * p.sway + i) * 14 : 0)) * dt; p.y += p.vy * dt;
      if (p.grow) p.size += p.grow * dt;
      if (p.vr) p.rot += p.vr * dt;
      const k = p.life / p.max;
      const a = p.a * Math.min(1, k * 2.4) * Math.min(1, (1 - k) * 8 + 0.2) * (p.tw ? 0.65 + 0.35 * Math.sin(now * p.tw + i) : 1);
      ctx.globalCompositeOperation = p.add ? "lighter" : "source-over";
      ctx.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${Math.max(0, a).toFixed(3)})`;
      const s = p.size;
      if (p.soft) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
        g.addColorStop(0, `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${Math.max(0, a).toFixed(3)})`); g.addColorStop(1, `rgba(${p.col[0]},${p.col[1]},${p.col[2]},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
      } else if (p.tri) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, s * 0.7); ctx.lineTo(-s * 0.6, s * 0.5); ctx.closePath(); ctx.fill(); ctx.restore();
      } else if (p.star) {
        const q = s * 3.2; ctx.beginPath();
        ctx.moveTo(p.x, p.y - q); ctx.quadraticCurveTo(p.x, p.y, p.x + q, p.y); ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + q);
        ctx.quadraticCurveTo(p.x, p.y, p.x - q, p.y); ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - q); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
        // a wide faint disc stands in for a glow; canvas shadowBlur is far too slow for this many sparks
        if (p.glow && !this.low) { ctx.fillStyle = `rgba(${p.glow[0]},${p.glow[1]},${p.glow[2]},${(Math.max(0, a) * 0.16).toFixed(3)})`; ctx.beginPath(); ctx.arc(p.x, p.y, s * 2.6, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  }

  destroy() { Loop.remove(this); window.removeEventListener("resize", this.resize); this.parts.length = 0; this.flames.length = 0; }
}
