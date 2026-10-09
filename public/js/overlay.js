// Grim Whispers: the gauge overlay for OBS. Add /overlay as a Browser Source.
// Options go in the address:  ?show=gauges  (hide the round strip)   ?side=dark|light  (one bar only)
//                             ?scale=1.5    (bigger or smaller)      ?align=top       (stick to the top)   ?bg=1 (dark backdrop, for testing)
import { Net } from "./net.js";
import { cardById, boonById } from "/shared/cards.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const Q = new URLSearchParams(location.search);
const app = document.getElementById("app");
const sides = Q.get("side") === "dark" ? ["dark"] : Q.get("side") === "light" ? ["light"] : ["dark", "light"];
const NAME = { dark: "ความมืด", light: "แสงสว่าง" };
app.style.setProperty("--go-scale", String(Math.max(0.4, Math.min(4, Number(Q.get("scale")) || 1))));
app.classList.toggle("is-top", Q.get("align") === "top");
app.classList.toggle("is-bg", Q.get("bg") === "1");
const showRound = Q.get("show") !== "gauges";
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

app.innerHTML = `
  <div class="go-bars">${sides.map((k) => `
    <div class="go-bar is-${k}" data-bar="${k}">
      <div class="go-head"><b>${NAME[k]}</b><span class="go-fills" data-fills></span><em data-state></em><span class="go-num" data-num></span></div>
      <div class="go-track"><i data-fill></i><u data-spark></u></div>
    </div>`).join("")}</div>
  <div class="go-round" data-round hidden></div>`;

let state = null; const last = { dark: null, light: null };
const net = new Net({ onState(s) { state = s; draw(); }, onLink(up) { app.classList.toggle("is-offline", !up); } });

function draw() {
  const s = state; if (!s) return;
  for (const k of sides) {
    const x = s.sides[k], el = app.querySelector(`[data-bar="${k}"]`);
    const pct = Math.max(0, Math.min(100, (x.gauge / x.target) * 100));
    el.querySelector("[data-fill]").style.width = `${pct}%`;
    el.querySelector("[data-spark]").style.left = `${pct}%`;
    el.querySelector("[data-num]").textContent = `${Math.round(x.gauge)} / ${x.target}`;
    el.querySelector("[data-fills]").innerHTML = Array.from({ length: s.maxFills }, (_, i) => `<i class="${i < x.fills ? "on" : ""}"></i>`).join("");
    el.querySelector("[data-state]").textContent = x.full ? "เต็มแล้ว!" : x.locked ? "ผนึกอยู่" : x.spent ? "ครบแล้ว" : `${x.members} คน`;
    el.classList.toggle("is-full", x.full); el.classList.toggle("is-locked", x.locked && !x.full);
    // every press makes the bar jump: pulse the head of the bar and float the gain
    if (last[k] != null && x.gauge > last[k] + 1e-6) {
      el.classList.remove("is-hit"); void el.offsetWidth; el.classList.add("is-hit");
      const f = document.createElement("span"); f.className = "go-plus"; f.textContent = `+${Math.round((x.gauge - last[k]) * 10) / 10}`; f.style.left = `${pct}%`;
      el.querySelector(".go-track").appendChild(f); setTimeout(() => f.remove(), 900);
    }
    last[k] = x.gauge;
  }
  round();
}

let roundKey = null;
function round() {
  const el = app.querySelector("[data-round]"), p = state.phase;
  if (!showRound || p.kind === "idle") { el.hidden = true; roundKey = null; return; }
  const key = JSON.stringify([p.kind, p.side, p.options, p.card, p.boon, p.tally, p.rollers, p.values]);
  el.hidden = false; el.className = `go-round is-${p.side} is-${p.kind}`;
  if (key !== roundKey) {
    roundKey = key;
    const name = (id) => (p.side === "dark" ? cardById(id)?.th.name : boonById(id)?.th.name) ?? id;
    if (p.kind === "vote") {
      const total = Math.max(1, Object.values(p.tally).reduce((a, b) => a + b, 0));
      el.innerHTML = `<div class="go-kicker"><b>ฝ่าย${NAME[p.side]}กำลังโหวต</b><span data-timer></span></div>
        <div class="go-opts">${p.options.map((id) => `<div class="go-opt"><b>${esc(name(id))}</b><div class="go-meter"><i style="width:${(p.tally[id] / total) * 100}%"></i></div><span>${p.tally[id]}</span></div>`).join("")}</div>`;
    } else if (p.card) {
      el.innerHTML = `<div class="go-kicker"><b>${p.by ? `การ์ดจาก ${esc(p.by)}` : "ห้วงลึกเลือกแล้ว"}</b><span data-timer></span></div>
        <div class="go-pick"><strong>${esc(name(p.card))}</strong><div class="go-dice">${p.rollers.map((r) => `<div class="${r.value == null ? "is-wait" : ""}"><i>${r.value ?? "?"}</i><span>${esc(r.name ?? "ห้วงลึก")}</span></div>`).join("")}</div></div>`;
    } else {
      const b = boonById(p.boon);
      el.innerHTML = `<div class="go-kicker"><b>${p.by ? `พรจาก ${esc(p.by)}` : "แสงส่องลงมา"}</b></div><div class="go-pick"><strong>${esc(b?.th.name ?? "")}</strong><p>${esc(b?.th.effect ?? "")}</p></div>`;
    }
  }
  tick();
}
function tick() { const t = app.querySelector("[data-timer]"); if (t) t.textContent = state?.phase.endsAt ? mmss(state.phase.endsAt - net.now()) : ""; }
setInterval(tick, 250);
