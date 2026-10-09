// Grim Whispers: the GM console. Open it as /dm#key=YOUR_GM_KEY.
import { Net } from "./net.js";
import { DARK, LIGHT, SUITS, PRESETS, cardById, boonById } from "/shared/cards.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const app = document.getElementById("app");
const key = new URLSearchParams(location.hash.slice(1)).get("key") ?? "";
const st = { s: null, gm: null, up: false, denied: false, note: "" };
const NAME = { dark: "Darkness", light: "Light" };
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

const net = new Net({
  onLink(up) { st.up = up; render(); },
  onState(s, me, gm) { st.s = s; st.gm = gm ?? st.gm; render(); },
  onMsg(m) {
    if (m.t === "welcome") { st.denied = !!m.gmDenied || !m.gm; render(); }
    else if (m.t === "gmack" && !m.ok) flash({ notfull: "That gauge is not full yet. Use Force to vote anyway.", busy: "A round is already running.", sealed: "No open cards for that side. Open some in the deck.", idle: "Nothing to clear." }[m.why] ?? `Refused: ${m.why}`);
  }
}, key);
const act = (a, extra = {}) => net.send({ t: "gm", a, ...extra });
let noteTimer;
function flash(text) { st.note = text; render(); clearTimeout(noteTimer); noteTimer = setTimeout(() => { st.note = ""; render(); }, 4000); }

/** A macro for Foundry until the direct link exists: opens the duel, lets the card show, then feeds the viewers' dice. */
function macro(p) {
  return `const gs = game.modules.get("grim-sanity")?.api;
if (!gs) return ui.notifications.warn("Grim Sanity is not active.");
await gs.startDuel({ cardId: "${p.card}" });
await new Promise((r) => setTimeout(r, 5200));
gs.setTrauma(${JSON.stringify(p.values)});`;
}

function gauge(k) {
  const x = st.s.sides[k], idle = st.s.phase.kind === "idle";
  return `
    <section class="gd-card gd-side is-${k}">
      <header><span class="gd-mark"></span><h2>${NAME[k]}</h2><em>${x.members} online · ${x.open} open</em></header>
      <div class="gd-gauge"><i style="width:${Math.min(100, (x.gauge / x.target) * 100).toFixed(1)}%"></i></div>
      <div class="gd-row"><b class="gd-num">${x.gauge} / ${x.target}</b><span>${x.full ? "FULL" : x.locked ? "Locked" : x.spent ? "Limit reached" : "Filling"}</span>
        <span class="gd-fills">Fills ${x.fills} / ${st.s.maxFills}<button data-a="setFills" data-side="${k}" data-n="${x.fills - 1}" title="One fill fewer">−</button><button data-a="setFills" data-side="${k}" data-n="${x.fills + 1}" title="One fill more">+</button></span></div>
      <div class="gd-btns">
        <button data-a="lock" data-side="${k}" data-locked="${x.locked ? "" : "1"}" class="${x.locked ? "" : "on"}">${x.locked ? "Unlock" : "Lock"}</button>
        <button data-a="nudge" data-side="${k}" data-delta="${-Math.ceil(x.target / 10)}">−10%</button>
        <button data-a="nudge" data-side="${k}" data-delta="${Math.ceil(x.target / 10)}">+10%</button>
        <button data-a="startVote" data-side="${k}" class="gd-go" ${idle && x.full ? "" : "disabled"}>Start vote</button>
        <button data-a="startVote" data-side="${k}" data-force="1" ${idle ? "" : "disabled"} title="Start a vote now, even if the gauge is not full">Force</button>
      </div>
      <ol class="gd-top">${x.top.map((t) => `<li><b>${esc(t.name)}</b><span>${t.n}</span></li>`).join("") || `<li class="is-empty">No one has pressed this round.</li>`}</ol>
    </section>`;
}

function round() {
  const p = st.s.phase;
  if (p.kind === "idle") return `<section class="gd-card gd-round"><header><span class="gd-mark"></span><h2>Round</h2></header><p class="gd-hint">No round is running. When a gauge is full, finish the beat you are on, then press Start vote on that side.</p></section>`;
  const label = (id) => (p.side === "dark" ? `${cardById(id)?.th.name} · ${cardById(id)?.en.name} · Trauma ${cardById(id)?.trauma}` : `${boonById(id)?.th.name} · ${boonById(id)?.en.name}`);
  let body = "";
  if (p.kind === "vote") {
    const total = Math.max(1, p.voters);
    body = `<div class="gd-row"><b class="gd-timer" data-timer>${mmss(p.endsAt - net.now())}</b><span>${p.voters} voted</span></div>
      ${p.options.map((id) => `<div class="gd-opt"><div><b>${esc(label(id))}</b><div class="gd-gauge"><i style="width:${(p.tally[id] / total) * 100}%"></i></div></div><span class="gd-num">${p.tally[id]}</span><button data-a="endVote" data-pick="${id}" title="End the vote with this option">Pick</button></div>`).join("")}
      <div class="gd-btns"><button data-a="endVote" class="gd-go">End vote now</button><button data-a="clear" title="Stop the vote. The gauge stays full.">Cancel</button></div>`;
  } else if (p.kind === "roll") {
    body = `<p class="gd-pick">${esc(label(p.card))}</p><div class="gd-row"><b class="gd-timer" data-timer>${mmss(p.endsAt - net.now())}</b><span>Viewers are rolling</span></div>
      <div class="gd-dice">${p.rollers.map((r) => `<div><i>${r.value ?? "?"}</i><span>${esc(r.name ?? "The abyss")}</span></div>`).join("")}</div>
      <div class="gd-btns"><button data-a="endRoll" class="gd-go">Roll remaining</button></div>`;
  } else if (p.card) {
    const c = cardById(p.card);
    body = `<p class="gd-pick">${esc(label(p.card))}</p>
      <div class="gd-dice is-done">${p.rollers.map((r) => `<div><i>${r.value}</i><span>${esc(r.name ?? "The abyss")}${r.auto ? " (auto)" : ""}</span></div>`).join("")}</div>
      <p class="gd-values">Trauma Dice: <b>${p.values.join(" · ")}</b></p>
      <p class="gd-th">${esc(c.th.board)}</p><p class="gd-th is-symptom">${esc(c.th.symptom)}</p>
      <div class="gd-btns"><button data-copy class="gd-go" title="Paste into a Foundry script macro and run it">Copy Foundry macro</button><button data-a="clear">Done · clear</button></div>
      <p class="gd-hint">Until the direct link to Foundry exists: copy the macro, run it in Foundry, then press Done.</p>`;
  } else {
    const b = boonById(p.boon);
    body = `<p class="gd-pick">${esc(label(p.boon))}</p><p class="gd-th">${esc(b.th.effect)}</p><p class="gd-th is-symptom">${esc(b.th.told)}</p>
      <div class="gd-btns"><button data-a="clear" class="gd-go">Done · clear</button></div><p class="gd-hint">Grant it from the Light tab of Grim Sanity in Foundry.</p>`;
  }
  return `<section class="gd-card gd-round is-${p.side} is-live"><header><span class="gd-mark"></span><h2>${NAME[p.side]} · ${p.kind}</h2></header>${body}</section>`;
}

function deck() {
  const d = st.gm.deck, cap = Number(d.cap) || 3;
  const suits = Object.entries(SUITS).map(([k, s]) => {
    const on = d.suits?.[k] !== false;
    return `<div class="gd-suit"><button data-suit="${k}" class="gd-switch ${on ? "on" : ""}"><i></i>${s.en} <small>${esc(s.th)}</small></button>
      <div class="gd-cards">${DARK.filter((c) => c.suit === k).map((c) => `<button data-a="toggleCard" data-id="${c.id}" class="gd-dcard ${on && !d.off?.[c.id] && c.trauma <= cap ? "on" : ""}" ${on ? "" : "disabled"}><span>${"◆".repeat(c.trauma)}</span><b>${esc(c.th.name)}</b><small>${esc(c.en.name)}</small></button>`).join("")}</div></div>`;
  }).join("");
  return `
    <section class="gd-card"><header><span class="gd-mark"></span><h2>Darkness deck</h2></header>
      <div class="gd-seg">${Object.entries(PRESETS).map(([k, p]) => `<button data-preset="${k}" class="${d.preset === k ? "on" : ""}">${p.label}</button>`).join("")}</div>
      <div class="gd-seg">${[1, 2, 3].map((n) => `<button data-cap="${n}" class="${cap === n ? "on" : ""}">${n === 3 ? "Any Trauma" : `Up to ${n}`}</button>`).join("")}</div>
      ${suits}
    </section>
    <section class="gd-card is-light"><header><span class="gd-mark"></span><h2>Light boons</h2></header>
      <div class="gd-cards">${LIGHT.map((b) => `<button data-a="toggleBoon" data-id="${b.id}" class="gd-dcard ${st.gm.lightOff?.[b.id] ? "" : "on"}"><span>✦</span><b>${esc(b.th.name)}</b><small>${esc(b.en.name)}</small></button>`).join("")}</div>
    </section>`;
}

function settings() {
  const c = st.gm.cfg;
  const f = (k, label, v, unit) => `<label><span>${label}</span><input type="number" data-cfg="${k}" value="${v}" min="1">${unit ? `<em>${unit}</em>` : ""}</label>`;
  return `
    <section class="gd-card"><header><span class="gd-mark"></span><h2>Pacing</h2></header>
      <div class="gd-form">${f("perViewer", "Presses per viewer to fill", c.perViewer)}${f("maxFills", "Fills per side per stream", c.maxFills)}${f("voteS", "Vote time", c.voteMs / 1000, "s")}${f("rollS", "Roll time", c.rollMs / 1000, "s")}${f("regenS", "One press returns every", c.regenMs / 1000, "s")}</div>
      <p class="gd-hint">A gauge that fills in under 15 minutes wants a higher first number; over 40 minutes, a lower one.</p>
    </section>
    <section class="gd-card"><header><span class="gd-mark"></span><h2>Viewers</h2><em>${st.gm.viewers.filter((v) => v.online).length} online · ${st.gm.total} joined</em></header>
      <div class="gd-viewers">${st.gm.viewers.slice(0, 60).map((v) => `<div class="is-${v.side} ${v.online ? "" : "is-off"} ${v.banned ? "is-banned" : ""}"><i></i><b>${esc(v.name)}</b><span>${v.presses}</span><button data-a="ban" data-id="${v.id}" data-banned="${v.banned ? "" : "1"}">${v.banned ? "Unban" : "Ban"}</button></div>`).join("") || `<p class="gd-hint">No one has joined yet.</p>`}</div>
    </section>
    <section class="gd-card"><header><span class="gd-mark"></span><h2>Stream</h2></header>
      <p class="gd-hint">Viewer link: <b class="gd-url">${esc(location.origin)}/</b> <button data-copyurl>Copy</button></p>
      <div class="gd-btns"><button data-new title="Gauges, fills and scores start over. Viewers keep their name and side.">New stream</button><button data-new="wipe" title="Also forget every viewer, so everyone picks a side again.">New stream, forget viewers</button></div>
    </section>`;
}

function render() {
  if (!key || st.denied) { app.innerHTML = `<div class="gd-boot"><h1>Grim Whispers</h1><p>${key ? "That GM key was not accepted." : "Open this page as <b>/dm#key=YOUR_GM_KEY</b>."}</p></div>`; return; }
  if (!st.s || !st.gm) return;
  if (app.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;   // do not redraw under the GM's typing
  const y = window.scrollY;
  app.innerHTML = `
    <header class="gd-head"><span class="gd-mark"></span><h1>Grim Whispers</h1><em class="${st.up ? "" : "is-down"}">${st.up ? "Connected" : "Reconnecting…"}</em>
      <div class="gd-btns"><button data-a="lock" data-side="both" data-locked="">Unlock both</button><button data-a="lock" data-side="both" data-locked="1">Lock both</button></div></header>
    ${st.note ? `<div class="gd-note">${esc(st.note)}</div>` : ""}
    <main><div class="gd-col">${gauge("dark")}${gauge("light")}${round()}</div><div class="gd-col">${deck()}</div><div class="gd-col">${settings()}</div></main>`;
  window.scrollTo(0, y);
}
setInterval(() => { const t = document.querySelector("[data-timer]"); if (t && st.s?.phase.endsAt) t.textContent = mmss(st.s.phase.endsAt - net.now()); }, 250);

app.addEventListener("click", async (ev) => {
  const b = ev.target.closest("button"); if (!b || b.disabled) return;
  const d = b.dataset;
  if ("copy" in d) { try { await navigator.clipboard.writeText(macro(st.s.phase)); flash("Macro copied. Paste it into a Foundry script macro."); } catch { flash("Could not copy. Select it by hand from the browser console."); console.log(macro(st.s.phase)); } return; }
  if ("copyurl" in d) { try { await navigator.clipboard.writeText(`${location.origin}/`); flash("Viewer link copied."); } catch { flash("Could not copy the link."); } return; }
  if ("new" in d) { if (confirm(d.new === "wipe" ? "Start a new stream and forget every viewer?" : "Start a new stream? Gauges, fills and scores start over.")) act("newSession", { wipe: d.new === "wipe" }); return; }
  if (d.preset) return act("setDeck", { deck: { preset: d.preset } });
  if (d.cap) return act("setDeck", { deck: { ...st.gm.deck, cap: Number(d.cap), preset: null } });
  if (d.suit) return act("setDeck", { deck: { ...st.gm.deck, suits: { ...(st.gm.deck.suits ?? {}), [d.suit]: st.gm.deck.suits?.[d.suit] === false }, preset: null } });
  if (!d.a) return;
  const m = {};
  if (d.side) m.side = d.side;
  if ("locked" in d) m.locked = !!d.locked;
  if (d.delta) m.delta = Number(d.delta);
  if (d.n != null) m.n = Number(d.n);
  if (d.force) m.force = true;
  if (d.pick) m.pick = d.pick;
  if (d.id) m.id = d.id;
  if ("banned" in d) m.banned = !!d.banned;
  act(d.a, m);
});

app.addEventListener("change", (ev) => {
  const k = ev.target.dataset.cfg; if (!k) return;
  const v = Number(ev.target.value); if (!(v > 0)) return;
  const map = { voteS: ["voteMs", 1000], rollS: ["rollMs", 1000], regenS: ["regenMs", 1000] };
  const [name, mul] = map[k] ?? [k, 1];
  act("setCfg", { cfg: { [name]: Math.round(v * mul) } });
  ev.target.blur();
});
