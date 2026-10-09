// Grim Sanity: real 3D dice built from CSS faces. A die spins in place while it waits,
// then spins hard and lands on its value. It never leaves its cell.
import { Loop } from "./fx.js";
import { pips } from "./art.js";

const TILT = 35.264; // how far an octahedron face leans from the vertical

// Rotation (x, y) that turns each face toward the viewer.
const D6 = { 1: [0, 0], 6: [0, 180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0] };
const D8 = {}; // faces 1-4 are the upper ring, 5-8 the lower ring
for (let k = 0; k < 4; k++) { D8[k + 1] = [-TILT, -90 * k]; D8[k + 5] = [TILT, -90 * k]; }

const ease = (t) => { const c = 1.25; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; }; // out, with a small settle

/** Next angle >= from + turns that is congruent to target (mod 360). */
const land = (from, target, turns) => {
  const base = from + turns * 360;
  return base + ((((target - base) % 360) + 360) % 360);
};

export class Die {
  /** @param kind "sanity" | "trauma" | "insane"   @param sides 6 | 8 */
  constructor(kind, sides = 6) {
    this.kind = kind; this.sides = sides; this.value = null;
    this.rx = Math.random() * 360; this.ry = Math.random() * 360;
    this.vx = 18 + Math.random() * 16; this.vy = 26 + Math.random() * 18;
    this.anim = null; this.idle = true;
    const el = this.el = document.createElement("div");
    el.className = `gsn-die gsn-d${sides} is-${kind} is-idle`;
    el.innerHTML = `<div class="gsn-die-aura"></div><div class="gsn-die-tilt"><div class="gsn-die-body">${sides === 8 ? this.#d8() : this.#d6()}</div></div><div class="gsn-die-mark"></div>`;
    this.body = el.querySelector(".gsn-die-body");
    this.apply();
    Loop.add(this);
  }

  #d6() { return [1, 2, 3, 4, 5, 6].map((v) => `<div class="gsn-face gsn-f${v}">${pips(v)}</div>`).join(""); }
  #d8() { return [1, 2, 3, 4, 5, 6, 7, 8].map((v) => `<div class="gsn-face gsn-f${v} ${v > 4 ? "is-low" : "is-up"}"><span>${v}</span></div>`).join(""); }

  apply() { this.body.style.transform = `rotateX(${this.rx.toFixed(2)}deg) rotateY(${this.ry.toFixed(2)}deg)`; }

  tick(dt, now) {
    if (this.anim) {
      const a = this.anim, t = Math.min(1, (now - a.t0) / a.dur), e = ease(t);
      this.rx = a.x0 + (a.x1 - a.x0) * e; this.ry = a.y0 + (a.y1 - a.y0) * e;
      this.apply();
      if (t >= 1) { this.anim = null; Loop.remove(this); this.el.classList.remove("is-rolling"); this.el.classList.add("is-landed"); a.done(); }
    } else if (this.idle) {
      this.rx += this.vx * dt; this.ry += this.vy * dt; this.apply();
    }
  }

  /** Spin and land on `value`. Resolves when the die has settled. */
  roll(value, { dur = 1.5, delay = 0 } = {}) {
    this.value = value; this.idle = false;
    this.el.classList.remove("is-idle", "is-landed", "is-win", "is-lose", "is-shone");
    return new Promise((done) => {
      const start = () => {
        if (!this.el.isConnected) { done(); return; }
        const [tx, ty] = (this.sides === 8 ? D8 : D6)[value] ?? [0, 0];
        this.el.classList.add("is-rolling");
        this.anim = { t0: performance.now() / 1000, dur, x0: this.rx, y0: this.ry, x1: land(this.rx, tx, 2), y1: land(this.ry, ty, 3), done };
        Loop.add(this);
      };
      delay ? setTimeout(start, delay) : start();
    });
  }

  /** Put the die straight onto a value with no animation (used when a client joins the result late). */
  show(value) {
    this.value = value; this.idle = false; this.anim = null;
    const [tx, ty] = (this.sides === 8 ? D8 : D6)[value] ?? [0, 0];
    this.rx = tx; this.ry = ty; this.apply(); Loop.remove(this);
    this.el.classList.remove("is-idle", "is-rolling"); this.el.classList.add("is-landed");
  }

  mark(cls) { this.el.classList.add(cls); }
  destroy() { Loop.remove(this); this.anim = null; this.el.remove(); }
}
