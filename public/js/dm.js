// Grim Whispers: the GM console. Open it as /dm#key=YOUR_GM_KEY.
import { Net } from "./net.js";
import { DARK, LIGHT, SUITS, SCENES, PRESETS, cardById, boonById } from "/shared/cards.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const app = document.getElementById("app");
const key = new URLSearchParams(location.hash.slice(1)).get("key") ?? "";
const st = { s: null, gm: null, up: false, denied: false, note: "", find: "" };
const NAME = { dark: "Darkness", light: "Light" };
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

const net = new Net({
  onLink(up) { st.up = up; render(); },
  onState(s, me, gm) { st.s = s; st.gm = gm ?? st.gm; render(); },
  onMsg(m) {
    if (m.t === "welcome") { st.denied = !!m.gmDenied || !m.gm; render(); }
    else if (m.t === "gmack" && !m.ok) flash({ notfull: "That gauge is not full yet. Use Force to vote anyway.", busy: "A round is already running.", sealed: "No open cards for that side. Open some in the deck.", idle: "Nothing to clear.", level: "Choose a level from 1 to 3." }[m.why] ?? `Refused: ${m.why}`);
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
  return `<section class="gd-card gd-round is-${p.side} is-live"><header><span class="gd-mark"></span><h2>${NAME[p.side]} · ${p.kind}</h2>${p.by ? `<em>chosen by ${esc(p.by)}</em>` : ""}</header>${body}</section>`;
}

/** Picks made by viewers who were given a choice, waiting for the GM to play them. */
function queue() {
  const q = st.gm.queue ?? []; if (!q.length) return "";
  const idle = st.s.phase.kind === "idle";
  return `<section class="gd-card gd-queue"><header><span class="gd-mark"></span><h2>Viewer picks</h2><em>${q.length} waiting</em></header>
    ${q.map((x) => { const c = x.side === "dark" ? cardById(x.option) : boonById(x.option);
      return `<div class="gd-opt is-${x.side}"><div><b>${esc(c?.th.name ?? x.option)} <small>${esc(c?.en.name ?? "")}</small></b><span class="gd-sub">${esc(x.name)} · ${NAME[x.side]} · level ${x.level}</span></div><button data-a="playQueued" data-qid="${x.qid}" class="gd-go" ${idle ? "" : "disabled"}>Play</button><button data-a="dropQueued" data-qid="${x.qid}" title="Discard this pick">Drop</button></div>`; }).join("")}
    <p class="gd-hint">Playing a pick does not touch the gauges or the fill count. For the Darkness, the giver rolls the first Trauma Die.</p></section>`;
}

function deck() {
  const d = st.gm.deck, cap = Number(d.cap) || 3, L = st.gm.light, lcap = Number(L.cap) || 3;
  const suits = Object.entries(SUITS).map(([k, sdef]) => {
    const on = d.suits?.[k] !== false;
    return `<div class="gd-suit"><button data-suit="${k}" class="gd-switch ${on ? "on" : ""}"><i></i>${sdef.en} <small>${esc(sdef.th)}</small></button>
      <div class="gd-cards">${DARK.filter((c) => c.suit === k).map((c) => `<button data-a="toggleCard" data-id="${c.id}" class="gd-dcard ${on && !d.off?.[c.id] && c.trauma <= cap ? "on" : ""}" ${on ? "" : "disabled"}><span>${"◆".repeat(c.trauma)}</span><b>${esc(c.th.name)}</b><small>${esc(c.en.name)}</small></button>`).join("")}</div></div>`;
  }).join("");
  const scene = d.preset && (d.preset === L.scene || (!SCENES[d.preset] && ["all", "sealed"].includes(L.scene))) ? d.preset : null;
  const inScene = (b) => L.scene === "all" || b.scenes.includes(L.scene);
  return `
    <section class="gd-card"><header><span class="gd-mark"></span><h2>Scene</h2><em>sets both decks</em></header>
      <div class="gd-seg">${Object.entries(PRESETS).map(([k, p]) => `<button data-scene="${k}" class="${scene === k ? "on" : ""}">${p.label}</button>`).join("")}</div>
    </section>
    <section class="gd-card"><header><span class="gd-mark"></span><h2>Darkness deck</h2><em>${st.s.sides.dark.open} open</em></header>
      <div class="gd-seg">${[1, 2, 3].map((n) => `<button data-cap="${n}" class="${cap === n ? "on" : ""}">${n === 3 ? "Any Trauma" : `Up to ${n}`}</button>`).join("")}</div>
      ${suits}
    </section>
    <section class="gd-card is-light"><header><span class="gd-mark"></span><h2>Light boons</h2><em>${st.s.sides.light.open} open</em></header>
      <div class="gd-seg">${[1, 2, 3].map((n) => `<button data-lcap="${n}" class="${lcap === n ? "on" : ""}">${n === 3 ? "Any tier" : `Up to tier ${n}`}</button>`).join("")}</div>
      <div class="gd-seg">${[["all", "All"], ...Object.entries(SCENES), ["sealed", "Sealed"]].map(([k, l]) => `<button data-lscene="${k}" class="${L.scene === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="gd-cards">${[...LIGHT].sort((a, b) => (inScene(b) - inScene(a)) || a.tier - b.tier).map((b) => `<button data-a="toggleBoon" data-id="${b.id}" class="gd-dcard ${L.scene !== "sealed" && inScene(b) && !L.off?.[b.id] && b.tier <= lcap ? "on" : ""}" title="${esc(b.th.effect)}"><span>${"◆".repeat(b.tier)}</span><b>${esc(b.th.name)}</b><small>${esc(b.scenes.map((x) => SCENES[x]).join(" · "))}</small></button>`).join("")}</div>
    </section>`;
}

function viewerRows() {
  const q = st.find.trim().toLowerCase();
  const list = st.gm.viewers.filter((v) => !q || v.name.toLowerCase().includes(q)).slice(0, 80);
  if (!list.length) return `<p class="gd-hint">${st.gm.total ? "No viewer matches that name." : "No one has joined yet."}</p>`;
  return list.map((v) => `<div class="is-${v.side} ${v.online ? "" : "is-off"} ${v.banned ? "is-banned" : ""}"><i></i><b title="${v.google ? "Signed in with Google" : "Guest"}">${esc(v.name)}${v.google ? " ✓" : ""}</b><span>${v.presses}</span>
    ${v.gift ? `<em class="gd-held">holds level ${v.gift}</em><button data-a="revoke" data-id="${v.id}" title="Take the choice back">×</button>`
      : `<span class="gd-give" title="Give this viewer a choice of ${v.side === "dark" ? "card" : "boon"} at this level">${[1, 2, 3].map((n) => `<button data-a="give" data-id="${v.id}" data-level="${n}">${n}</button>`).join("")}</span>`}
    <button data-a="ban" data-id="${v.id}" data-banned="${v.banned ? "" : "1"}">${v.banned ? "Unban" : "Ban"}</button></div>`).join("");
}

function settings() {
  const c = st.gm.cfg;
  const f = (k, label, v, unit, hint) => `<label title="${esc(hint ?? "")}"><span>${label}</span><input type="number" data-cfg="${k}" value="${v}" min="0" step="any">${unit ? `<em>${unit}</em>` : "<em></em>"}</label>`;
  return `
    <section class="gd-card"><header><span class="gd-mark"></span><h2>Pacing</h2></header>
      <div class="gd-form">
        ${f("pool", "Gauge size", c.pool, "", "The gauge is never smaller than this. Both sides use the same size.")}
        ${f("perViewer", "Extra size per viewer", c.perViewer, "", "The gauge grows to (viewers on the larger side x this) when that is more than the gauge size. 0 keeps the gauge at exactly the size above.")}
        ${f("energyMax", "Presses a viewer can hold", c.energyMax, "", "How many presses a viewer can bank.")}
        ${f("regenS", "One press returns every", c.regenMs / 1000, "s", "How long until a viewer gets one press back.")}
        ${f("growthPct", "Each fill makes the next larger by", Math.round((c.growth - 1) * 100), "%", "")}
        ${f("maxFills", "Fills per side per stream", c.maxFills, "", "")}
        ${f("voteS", "Vote time", c.voteMs / 1000, "s", "")}${f("rollS", "Roll time", c.rollMs / 1000, "s", "")}
      </div>
      <div class="gd-row"><button data-balance class="gd-switch ${c.balance ? "on" : ""}"><i></i>Balance the sides</button><span class="gd-fills">Dark ×${st.s.sides.dark.weight} · Light ×${st.s.sides.light.weight}</span></div>
      <div class="gd-form">${f("balanceCap", "Most one press can be worth", c.balanceCap, "", "With 10 viewers against 3, the 3 press for 3.3 each. This caps that number.")}</div>
      <p class="gd-hint">A gauge that fills in under 15 minutes wants a larger size; over 40 minutes, a smaller one.</p>
    </section>
    <section class="gd-card"><header><span class="gd-mark"></span><h2>Viewers</h2><em>${st.gm.viewers.filter((v) => v.online).length} online · ${st.gm.total} joined</em></header>
      <input type="search" class="gd-find" data-find placeholder="Find a viewer by name" value="${esc(st.find)}">
      <div class="gd-viewers" data-viewers>${viewerRows()}</div>
      <p class="gd-hint">1 · 2 · 3 gives that viewer a choice of card (Darkness) or boon (Light) at that level, for example after a donation. Their pick appears under Viewer picks.</p>
    </section>
    <section class="gd-card"><header><span class="gd-mark"></span><h2>Stream</h2></header>
      <p class="gd-hint">Viewer link: <b class="gd-url">${esc(location.origin)}/</b> <button data-copyurl="/">Copy</button></p>
      <p class="gd-hint">OBS browser source: <b class="gd-url">${esc(location.origin)}/overlay</b> <button data-copyurl="/overlay">Copy</button></p>
      <div class="gd-btns"><button data-new title="Gauges, fills and scores start over. Viewers keep their name and side.">New stream</button><button data-new="wipe" title="Also forget every viewer, so everyone picks a side again.">New stream, forget viewers</button></div>
    </section>`;
}

function render() {
  if (!key || st.denied) { app.innerHTML = `<div class="gd-boot"><h1>Grim Whispers</h1><p>${key ? "That GM key was not accepted." : "Open this page as <b>/dm#key=YOUR_GM_KEY</b>."}</p></div>`; return; }
  if (!st.s || !st.gm) return;
  if (app.contains(document.activeElement) && document.activeElement.tagName === "INPUT") {         // do not redraw under the GM's typing
    if ("find" in document.activeElement.dataset) { const box = document.querySelector("[data-viewers]"); if (box) box.innerHTML = viewerRows(); }
    return;
  }
  const y = window.scrollY;
  app.innerHTML = `
    <header class="gd-head"><span class="gd-mark"></span><h1>Grim Whispers</h1><em class="${st.up ? "" : "is-down"}">${st.up ? "Connected" : "Reconnecting…"}</em>
      <div class="gd-btns"><button data-a="lock" data-side="both" data-locked="">Unlock both</button><button data-a="lock" data-side="both" data-locked="1">Lock both</button></div></header>
    ${st.note ? `<div class="gd-note">${esc(st.note)}</div>` : ""}
    <main><div class="gd-col">${gauge("dark")}${gauge("light")}${round()}${queue()}</div><div class="gd-col">${deck()}</div><div class="gd-col">${settings()}</div></main>`;
  window.scrollTo(0, y);
}
setInterval(() => { const t = document.querySelector("[data-timer]"); if (t && st.s?.phase.endsAt) t.textContent = mmss(st.s.phase.endsAt - net.now()); }, 250);

app.addEventListener("click", async (ev) => {
  const b = ev.target.closest("button"); if (!b || b.disabled) return;
  const d = b.dataset;
  if ("copy" in d) { try { await navigator.clipboard.writeText(macro(st.s.phase)); flash("Macro copied. Paste it into a Foundry script macro."); } catch { flash("Could not copy. Select it by hand from the browser console."); console.log(macro(st.s.phase)); } return; }
  if ("copyurl" in d) { try { await navigator.clipboard.writeText(`${location.origin}${d.copyurl || "/"}`); flash("Link copied."); } catch { flash("Could not copy the link."); } return; }
  if (d.scene) return act("setScene", { scene: d.scene });
  if (d.lcap) return act("setLight", { light: { cap: Number(d.lcap) } });
  if (d.lscene) return act("setLight", { light: { scene: d.lscene } });
  if ("balance" in d) return act("setCfg", { cfg: { balance: !st.gm.cfg.balance } });
  if ("new" in d) { if (confirm(d.new === "wipe" ? "Start a new stream and forget every viewer?" : "Start a new stream? Gauges, fills and scores start over.")) act("newSession", { wipe: d.new === "wipe" }); return; }
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
  if (d.level) m.level = Number(d.level);
  if (d.qid) m.qid = Number(d.qid);
  act(d.a, m);
});

app.addEventListener("change", (ev) => {
  const k = ev.target.dataset.cfg; if (!k) return;
  const v = Number(ev.target.value); if (!Number.isFinite(v) || v < 0) return;
  const map = { voteS: ["voteMs", v * 1000], rollS: ["rollMs", v * 1000], regenS: ["regenMs", v * 1000], growthPct: ["growth", 1 + v / 100] };
  const [name, val] = map[k] ?? [k, v];
  act("setCfg", { cfg: { [name]: val } });
  ev.target.blur();
});

// Searching filters the list in place, so the box keeps its focus while the GM types.
app.addEventListener("input", (ev) => {
  if (!("find" in ev.target.dataset)) return;
  st.find = ev.target.value;
  const box = document.querySelector("[data-viewers]"); if (box) box.innerHTML = viewerRows();
});
