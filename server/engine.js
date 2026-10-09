// Grim Whispers: the game state, with no network code, so it can be tested alone.
// Time and randomness are injected. Every method returns { ok } or { ok: false, why }.
import { DARK, LIGHT, cardById, boonById, openCards, presetDeck } from "../shared/cards.js";

export const SIDES = ["dark", "light"];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const no = (why) => ({ ok: false, why });
const yes = (extra = {}) => ({ ok: true, ...extra });

export const DEFAULTS = {
  energyMax: 5,        // presses a viewer can bank
  regenMs: 30000,      // one press comes back this often
  perViewer: 20,       // gauge target = members x this
  minTarget: 20,       // never smaller than this, so one viewer cannot fill it at once
  growth: 1.25,        // each fill makes that side's next target this much larger
  maxFills: 3,         // fills per side per session
  voteMs: 60000,
  rollMs: 15000,
  nameMax: 20
};

export class Engine {
  constructor({ now = () => Date.now(), rand = Math.random, cfg = {} } = {}) {
    this.now = now; this.rand = rand; this.cfg = { ...DEFAULTS, ...cfg };
    this.viewers = new Map();   // id -> viewer
    this.side = { dark: this.#fresh(), light: this.#fresh() };
    this.deck = { off: {}, suits: {}, cap: 3, preset: "travel" };
    this.lightOff = {};         // boon id -> true when closed
    this.phase = { kind: "idle" };
    this.log = [];              // finished rounds, newest last
    this.rev = 0;               // bumps on every change, so the server knows when to broadcast
  }

  #fresh() { return { gauge: 0, fills: 0, locked: true, peak: 0, contrib: new Map() }; }
  #touch() { this.rev++; }
  #int(n) { return Math.floor(this.rand() * n); }

  /* ---------- viewers ---------- */
  join(id, name, side) {
    name = String(name ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, this.cfg.nameMax);
    if (!name) return no("name");
    let v = this.viewers.get(id);
    if (!v) {
      if (!SIDES.includes(side)) return no("side");
      v = { id, name, side, energy: this.cfg.energyMax, at: this.now(), score: 0, presses: 0, online: 0, banned: false };
      this.viewers.set(id, v);
    } else v.name = name;       // the side stays as first chosen for the whole session
    this.#touch();
    return yes({ viewer: v });
  }

  /** A connection opened (+1) or closed (-1) for this viewer. */
  online(id, delta) {
    const v = this.viewers.get(id); if (!v) return;
    v.online = Math.max(0, v.online + delta);
    this.#touch();
  }

  members(side) { let n = 0; for (const v of this.viewers.values()) if (v.side === side && v.online > 0 && !v.banned) n++; return n; }

  /** Energy is worked out on demand from the time of the last change. */
  energy(v) {
    const { energyMax, regenMs } = this.cfg;
    if (v.energy >= energyMax) { v.at = this.now(); return v.energy; }
    const gained = Math.floor((this.now() - v.at) / regenMs);
    if (gained > 0) { v.energy = Math.min(energyMax, v.energy + gained); v.at = v.energy >= energyMax ? this.now() : v.at + gained * regenMs; }
    return v.energy;
  }

  /* ---------- gauges ---------- */
  target(side) {
    const s = this.side[side];
    s.peak = Math.max(s.peak, this.members(side));   // within a round the target only grows
    const base = Math.max(this.cfg.minTarget, s.peak * this.cfg.perViewer);
    return Math.round(base * Math.pow(this.cfg.growth, s.fills));
  }
  full(side) { return this.side[side].gauge >= this.target(side); }
  spent(side) { return this.side[side].fills >= this.cfg.maxFills; }

  whisper(id) {
    const v = this.viewers.get(id);
    if (!v || v.banned) return no("unknown");
    const s = this.side[v.side];
    if (s.locked) return no("locked");
    if (this.spent(v.side)) return no("spent");
    if (this.full(v.side)) return no("full");
    if (this.energy(v) < 1) return no("energy");
    if (v.energy >= this.cfg.energyMax) v.at = this.now();
    v.energy--; v.presses++;
    s.gauge = Math.min(this.target(v.side), s.gauge + 1);
    s.contrib.set(id, (s.contrib.get(id) ?? 0) + 1);
    this.#touch();
    return yes({ full: this.full(v.side) });
  }

  /** Top contributors of a side this round, online viewers first. */
  top(side, count = 5) {
    return [...this.side[side].contrib.entries()]
      .map(([id, n]) => ({ v: this.viewers.get(id), n }))
      .filter((x) => x.v && !x.v.banned)
      .sort((a, b) => ((b.v.online > 0) - (a.v.online > 0)) || b.n - a.n)
      .slice(0, count);
  }

  /* ---------- a round: vote, then (for the dark) roll ---------- */
  options(side) {
    const pool = side === "dark" ? openCards(this.deck).map((c) => c.id) : LIGHT.filter((b) => !this.lightOff[b.id]).map((b) => b.id);
    for (let i = pool.length - 1; i > 0; i--) { const j = this.#int(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, 3);
  }

  startVote(side, { force = false } = {}) {
    if (!SIDES.includes(side)) return no("side");
    if (this.phase.kind !== "idle") return no("busy");
    if (!force && !this.full(side)) return no("notfull");
    const options = this.options(side);
    if (!options.length) return no("sealed");
    this.phase = { kind: "vote", side, options, votes: new Map(), endsAt: this.now() + this.cfg.voteMs };
    this.#touch();
    if (options.length === 1) return this.endVote();
    return yes();
  }

  vote(id, option) {
    const v = this.viewers.get(id), p = this.phase;
    if (!v || v.banned) return no("unknown");
    if (p.kind !== "vote") return no("novote");
    if (v.side !== p.side) return no("side");
    if (!p.options.includes(option)) return no("option");
    p.votes.set(id, option);
    this.#touch();
    return yes();
  }

  tally() {
    const p = this.phase; if (p.kind !== "vote") return {};
    const t = Object.fromEntries(p.options.map((o) => [o, 0]));
    for (const o of p.votes.values()) t[o]++;
    return t;
  }

  endVote(pick = null) {
    const p = this.phase;
    if (p.kind !== "vote") return no("novote");
    const t = this.tally();
    let winner = pick && p.options.includes(pick) ? pick : null;
    if (!winner) {
      const best = Math.max(...Object.values(t));
      const tied = p.options.filter((o) => t[o] === best);
      winner = tied[this.#int(tied.length)];
    }
    for (const [id, o] of p.votes) if (o === winner) { const v = this.viewers.get(id); if (v) v.score += 1; }
    const side = p.side, s = this.side[side];
    if (side === "dark") {
      const card = cardById(winner);
      const chosen = this.top("dark", card.trauma);
      const rollers = Array.from({ length: card.trauma }, (_, i) => {
        const c = chosen[i];
        return c ? { id: c.v.id, name: c.v.name, value: null } : { id: null, name: null, value: null };   // no viewer: the abyss rolls
      });
      this.phase = { kind: "roll", side, card: winner, trauma: card.trauma, tally: t, rollers, endsAt: this.now() + this.cfg.rollMs };
      this.#resetSide(side);
      this.#touch();
      if (rollers.every((r) => !r.id)) return this.endRoll();
      return yes({ winner });
    }
    this.phase = { kind: "result", side, boon: winner, tally: t };
    this.#resetSide(side);
    this.#record();
    this.#touch();
    return yes({ winner });
  }

  #resetSide(side) { const s = this.side[side]; s.gauge = 0; s.fills++; s.peak = 0; s.contrib = new Map(); }

  roll(id) {
    const p = this.phase;
    if (p.kind !== "roll") return no("noroll");
    const r = p.rollers.find((x) => x.id === id && x.value == null);
    if (!r) return no("notyours");
    r.value = 1 + this.#int(6);
    const v = this.viewers.get(id); if (v) v.score += 3;
    this.#touch();
    if (p.rollers.every((x) => x.value != null)) this.endRoll();
    return yes({ value: r.value });
  }

  endRoll() {
    const p = this.phase;
    if (p.kind !== "roll") return no("noroll");
    for (const r of p.rollers) if (r.value == null) { r.value = 1 + this.#int(6); r.auto = true; }
    this.phase = { kind: "result", side: "dark", card: p.card, trauma: p.trauma, tally: p.tally, rollers: p.rollers, values: p.rollers.map((r) => r.value).sort((a, b) => b - a) };
    this.#record();
    this.#touch();
    return yes({ values: this.phase.values });
  }

  #record() {
    const p = this.phase;
    this.log.push({ at: this.now(), side: p.side, card: p.card ?? null, boon: p.boon ?? null, values: p.values ?? null, rollers: (p.rollers ?? []).map((r) => r.name) });
    if (this.log.length > 50) this.log.shift();
  }

  /** The GM has dealt with the result; back to filling gauges. */
  clear() {
    if (this.phase.kind === "idle") return no("idle");
    // Cancelling a vote before it ends gives nothing and costs nothing; the gauge stays full.
    this.phase = { kind: "idle" };
    this.#touch();
    return yes();
  }

  /** Timers. Call a few times a second. */
  tick() {
    const p = this.phase;
    if (p.kind === "vote" && this.now() >= p.endsAt) this.endVote();
    else if (p.kind === "roll" && this.now() >= p.endsAt) this.endRoll();
  }

  /* ---------- GM controls ---------- */
  lock(side, locked) { for (const s of side === "both" ? SIDES : [side]) if (this.side[s]) this.side[s].locked = !!locked; this.#touch(); return yes(); }
  nudge(side, delta) { const s = this.side[side]; if (!s) return no("side"); s.gauge = clamp(Math.round(s.gauge + delta), 0, this.target(side)); this.#touch(); return yes(); }
  setFills(side, n) { const s = this.side[side]; if (!s) return no("side"); s.fills = clamp(Math.round(n), 0, 99); s.gauge = Math.min(s.gauge, this.target(side)); this.#touch(); return yes(); }
  setCfg(patch) {
    for (const k of ["perViewer", "maxFills", "voteMs", "rollMs", "regenMs", "energyMax", "minTarget"]) {
      if (Number.isFinite(patch?.[k]) && patch[k] > 0) this.cfg[k] = patch[k];
    }
    this.#touch(); return yes();
  }
  setDeck(deck) {
    if (deck?.preset && !deck.off) { const d = presetDeck(deck.preset); if (!d) return no("preset"); this.deck = d; }
    else this.deck = { off: { ...(deck?.off ?? {}) }, suits: { ...(deck?.suits ?? {}) }, cap: clamp(Number(deck?.cap) || 3, 1, 3), preset: deck?.preset ?? null };
    this.#touch(); return yes();
  }
  toggleCard(id) { if (!cardById(id)) return no("card"); if (this.deck.off[id]) delete this.deck.off[id]; else this.deck.off[id] = true; this.deck.preset = null; this.#touch(); return yes(); }
  toggleBoon(id) { if (!boonById(id)) return no("boon"); if (this.lightOff[id]) delete this.lightOff[id]; else this.lightOff[id] = true; this.#touch(); return yes(); }
  ban(id, banned = true) { const v = this.viewers.get(id); if (!v) return no("unknown"); v.banned = !!banned; this.#touch(); return yes(); }

  /** A new stream: gauges, fills and round scores start over. Viewers keep their name and side unless `wipe`. */
  newSession({ wipe = false } = {}) {
    this.side = { dark: this.#fresh(), light: this.#fresh() };
    this.phase = { kind: "idle" };
    if (wipe) this.viewers.clear();
    else for (const v of this.viewers.values()) { v.energy = this.cfg.energyMax; v.at = this.now(); v.score = 0; v.presses = 0; }
    this.log = [];
    this.#touch(); return yes();
  }

  /* ---------- what clients see ---------- */
  publicState() {
    const sides = {};
    for (const s of SIDES) {
      const x = this.side[s];
      sides[s] = {
        gauge: x.gauge, target: this.target(s), fills: x.fills, locked: x.locked, full: this.full(s), spent: this.spent(s), members: this.members(s),
        open: s === "dark" ? openCards(this.deck).length : LIGHT.filter((b) => !this.lightOff[b.id]).length,
        top: this.top(s, 3).map((t) => ({ name: t.v.name, n: t.n }))
      };
    }
    const p = this.phase;
    let phase = { kind: p.kind };
    if (p.kind === "vote") phase = { kind: "vote", side: p.side, options: p.options, tally: this.tally(), voters: p.votes.size, endsAt: p.endsAt };
    else if (p.kind === "roll") phase = { kind: "roll", side: p.side, card: p.card, trauma: p.trauma, tally: p.tally, endsAt: p.endsAt, rollers: p.rollers.map((r) => ({ name: r.name, value: r.value })) };
    else if (p.kind === "result") phase = { kind: "result", side: p.side, card: p.card ?? null, boon: p.boon ?? null, trauma: p.trauma ?? null, tally: p.tally, values: p.values ?? null, rollers: (p.rollers ?? []).map((r) => ({ name: r.name, value: r.value, auto: !!r.auto })) };
    return { now: this.now(), sides, phase, maxFills: this.cfg.maxFills, energyMax: this.cfg.energyMax, regenMs: this.cfg.regenMs };
  }

  privateState(id) {
    const v = this.viewers.get(id); if (!v) return null;
    const p = this.phase;
    const energy = this.energy(v);
    return {
      id: v.id, name: v.name, side: v.side, energy, nextAt: energy >= this.cfg.energyMax ? null : v.at + this.cfg.regenMs,
      contrib: this.side[v.side].contrib.get(id) ?? 0, score: v.score, banned: v.banned,
      vote: p.kind === "vote" ? p.votes.get(id) ?? null : null,
      roller: p.kind === "roll" ? p.rollers.findIndex((r) => r.id === id && r.value == null) : -1
    };
  }

  gmState() {
    return {
      deck: this.deck, lightOff: this.lightOff, cfg: this.cfg, log: this.log.slice(-10),
      viewers: [...this.viewers.values()].map((v) => ({ id: v.id, name: v.name, side: v.side, online: v.online > 0, presses: v.presses, score: v.score, banned: v.banned }))
        .sort((a, b) => (b.online - a.online) || b.presses - a.presses).slice(0, 200),
      total: this.viewers.size
    };
  }

  /* ---------- save / load ---------- */
  snapshot() {
    const side = {};
    for (const s of SIDES) { const x = this.side[s]; side[s] = { ...x, contrib: [...x.contrib] }; }
    return { v: 1, side, deck: this.deck, lightOff: this.lightOff, cfg: this.cfg, log: this.log, viewers: [...this.viewers.values()].map((v) => ({ ...v, online: 0 })) };
  }
  restore(d) {
    if (d?.v !== 1) return false;
    for (const s of SIDES) if (d.side?.[s]) this.side[s] = { ...this.#fresh(), ...d.side[s], contrib: new Map(d.side[s].contrib ?? []) };
    this.deck = d.deck ?? this.deck; this.lightOff = d.lightOff ?? {}; this.cfg = { ...this.cfg, ...(d.cfg ?? {}) }; this.log = d.log ?? [];
    this.viewers = new Map((d.viewers ?? []).map((v) => [v.id, { ...v, online: 0 }]));
    this.phase = { kind: "idle" };   // a round in flight does not survive a restart
    this.#touch();
    return true;
  }
}

export { DARK, LIGHT };
