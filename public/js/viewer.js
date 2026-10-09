// Grim Whispers: the viewer page. Pick a side, press to fill the gauge, vote, and roll when chosen.
import { Net } from "./net.js";
import { Die } from "./dice.js";
import { Field } from "./fx.js";
import { sigil } from "./art.js";
import { cardById, boonById, SUITS, TIER, TIER_LABEL } from "/shared/cards.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const app = $("#app");
const SIDE = {
  dark: { name: "ความมืด", press: "กระซิบ", role: "สร้างอุปสรรคให้ปาร์ตี้ โหวตการ์ด และทอยเต๋าสู้กับผู้เล่น", top: "ผู้กระซิบเอกรอบนี้", art: "abyss", fx: "ember" },
  light: { name: "แสงสว่าง", press: "จุดแสง", role: "พยุงปาร์ตี้ให้รอด โหวตพรส่งไปให้พวกเขา", top: "ผู้ถือแสงรอบนี้", art: "light", fx: "gold" }
};
const WHY = { locked: "ห้วงลึกยังเงียบอยู่", full: "เกจเต็มแล้ว", spent: "ฝ่ายคุณใช้ครบแล้วในไลฟ์นี้", energy: "แรงหมด รอสักครู่" };

const st = { s: null, me: null, up: false, screen: null, overlay: null, draft: { name: "", side: null }, dice: [], fx: null, joining: false, peek: null };
try { st.draft.name = localStorage.getItem("grim-whispers-name") ?? ""; } catch { /* no storage */ }

const net = new Net({
  onLink(up) { st.up = up; app.classList.toggle("is-offline", !up); },
  onState(s, me) { st.s = s; st.me = me; render(); },
  onMe(me) { st.me = me; update(); },
  onMsg(m) {
    if (m.t === "joined") { st.joining = false; if (!m.ok) toast(m.why === "name" ? "ใส่ชื่อก่อนนะ" : "เลือกฝ่ายก่อนนะ"); }
    else if (m.t === "no" && WHY[m.why]) toast(WHY[m.why]);
  }
});

/* ---------- small helpers ---------- */
let toastTimer;
function toast(text) {
  let t = $(".gw-toast"); if (!t) { t = document.createElement("div"); t.className = "gw-toast"; document.body.appendChild(t); }
  t.textContent = text; t.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 1800);
}
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const pct = (x) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;

function cardHtml(id, { compact = false } = {}) {
  const c = cardById(id); if (!c) return "";
  const tier = TIER(c.trauma);
  const pips = Array.from({ length: 3 }, (_, i) => `<i class="${i < c.trauma ? "on" : ""}"></i>`).join("");
  return `
    <div class="gsn-card gsn-suit-${c.suit} gsn-tier-${tier}${compact ? " is-compact" : ""}">
      <div class="gsn-card-face">
        <div class="gsn-card-top"><span class="gsn-card-suit">${esc(SUITS[c.suit].th)}</span><span class="gsn-card-pips">${pips}</span></div>
        <div class="gsn-card-art">${sigil(c.suit)}</div>
        <div class="gsn-card-name">${esc(c.th.name)}</div>
        <div class="gsn-card-sub"><span>${esc(c.en.name)}</span></div>
        ${compact ? "" : `<div class="gsn-card-sec"><label>เกิดอะไรขึ้น</label><p>${esc(c.th.board)}</p></div>
        <div class="gsn-card-sec is-symptom"><label>อาการ</label><p>${esc(c.th.symptom)}</p></div>`}
        <div class="gsn-card-foot"><b>Trauma ${c.trauma}</b><i></i><span>${TIER_LABEL[tier]}</span></div>
      </div>
    </div>`;
}

/* ---------- screens ---------- */
function render() {
  const { s, me } = st; if (!s) return;
  const screen = me ? "main" : "join";
  if (screen !== st.screen) {
    st.screen = screen; st.overlay = null; clearDice();
    st.fx?.destroy(); st.fx = null;
    app.className = `gw is-${screen}${me ? ` is-${me.side}` : ""}${st.up ? "" : " is-offline"}`;
    app.innerHTML = screen === "join" ? joinHtml() : mainHtml();
    if (screen === "main") { st.fx = new Field($(".gw-fx"), { low: false }); st.fx.ambient = 5; }
  }
  update();
}

function joinHtml() {
  const side = (k) => `
    <button type="button" class="gw-side is-${k}${st.draft.side === k ? " on" : ""}" data-side="${k}">
      <span class="gw-side-art">${sigil(SIDE[k].art)}</span>
      <b>${SIDE[k].name}</b><span>${SIDE[k].role}</span><em data-count="${k}"></em>
    </button>`;
  return `
    <div class="gw-join">
      <div class="gw-kicker"><span>Out of the Abyss</span></div>
      <h1>เสียงกระซิบ<br>แห่งห้วงลึก</h1>
      <p class="gw-lead">คืนนี้คุณไม่ได้แค่ดู คุณคือส่วนหนึ่งของ Underdark</p>
      <label class="gw-field"><span>ชื่อที่จะขึ้นบนจอ</span><input id="gw-name" type="text" maxlength="20" autocomplete="nickname" enterkeyhint="done" value="${esc(st.draft.name)}" placeholder="ชื่อของคุณ"></label>
      <div class="gw-sides">${side("dark")}${side("light")}</div>
      <p class="gw-note">เลือกแล้วเปลี่ยนฝ่ายไม่ได้จนจบไลฟ์</p>
      <button type="button" class="gw-go" data-join disabled>ก้าวลงสู่ห้วงลึก</button>
    </div>`;
}

function mainHtml() {
  const me = st.me, sd = SIDE[me.side];
  const bar = (k) => `
    <div class="gw-bar is-${k}${k === me.side ? " is-mine" : ""}" data-bar="${k}">
      <div class="gw-bar-head"><b>${SIDE[k].name}</b><span data-num></span></div>
      <div class="gw-bar-track"><i data-fill></i></div>
      <div class="gw-bar-foot"><span data-members></span><span class="gw-fills" data-fills></span></div>
    </div>`;
  return `
    <canvas class="gw-fx"></canvas>
    <header class="gw-top">
      <div class="gw-me"><b>${esc(me.name)}</b><span>ฝ่าย${sd.name}</span></div>
      <div class="gw-score"><i></i><span data-score>0</span></div>
    </header>
    <section class="gw-versus">${bar("dark")}${bar("light")}</section>
    <section class="gw-core">
      <div class="gw-ring">
        <svg viewBox="0 0 200 200" aria-hidden="true"><circle class="gw-ring-bg" cx="100" cy="100" r="92"/><circle class="gw-ring-fg" cx="100" cy="100" r="92" pathLength="100" stroke-dasharray="0 100" data-ring/></svg>
        <button type="button" class="gw-press" data-press aria-label="${sd.press}"><span class="gw-press-art">${sigil(sd.art)}</span><b>${sd.press}</b></button>
      </div>
      <div class="gw-energy" data-energy></div>
      <div class="gw-next" data-next></div>
      <div class="gw-status" data-status></div>
    </section>
    <section class="gw-tops"><h3>${sd.top}</h3><ol data-tops></ol></section>
    <div class="gw-overlay" data-overlay hidden></div>
    <div class="gw-link">กำลังเชื่อมต่อใหม่…</div>`;
}

/* ---------- live updates (no re-render, so animations keep running) ---------- */
function update() {
  const { s, me } = st; if (!s) return;
  if (st.screen === "join") {
    for (const k of ["dark", "light"]) { const el = $(`[data-count="${k}"]`); if (el) el.textContent = `${s.sides[k].members} คนอยู่ฝ่ายนี้`; }
    const go = $("[data-join]"); if (go) go.disabled = !(st.draft.name.trim() && st.draft.side) || st.joining;
    return;
  }
  if (!me) return;
  for (const k of ["dark", "light"]) {
    const x = s.sides[k], el = $(`[data-bar="${k}"]`); if (!el) continue;
    $("[data-fill]", el).style.width = pct(x.gauge / x.target);
    $("[data-num]", el).textContent = `${x.gauge} / ${x.target}`;
    $("[data-members]", el).textContent = `${x.members} คน`;
    $("[data-fills]", el).innerHTML = Array.from({ length: s.maxFills }, (_, i) => `<i class="${i < x.fills ? "on" : ""}"></i>`).join("");
    el.classList.toggle("is-full", x.full); el.classList.toggle("is-locked", x.locked);
  }
  const mine = s.sides[me.side];
  $("[data-ring]").setAttribute("stroke-dasharray", `${Math.min(100, (mine.gauge / mine.target) * 100).toFixed(2)} 100`);
  $("[data-score]").textContent = me.score;
  $("[data-energy]").innerHTML = Array.from({ length: s.energyMax }, (_, i) => `<i class="${i < me.energy ? "on" : ""}"></i>`).join("");
  const can = canPress();
  const press = $("[data-press]"); press.classList.toggle("is-off", !can); press.classList.toggle("is-full", mine.full && !mine.spent);
  $("[data-status]").textContent = me.banned ? "คุณถูกระงับจากไลฟ์นี้" : mine.spent ? `ฝ่าย${SIDE[me.side].name}ใช้ครบ ${s.maxFills} ครั้งในไลฟ์นี้แล้ว` : mine.full ? "เกจเต็มแล้ว! รอ DM เปิดโหวต" : mine.locked ? "ห้วงลึกยังเงียบอยู่ รอ DM เปิดเกจ" : me.contrib ? `รอบนี้คุณส่งแรงไปแล้ว ${me.contrib} ครั้ง` : "กดเพื่อส่งแรงเข้าเกจฝ่ายคุณ";
  $("[data-tops]").innerHTML = mine.top.length ? mine.top.map((t) => `<li><b>${esc(t.name)}</b><span>${t.n}</span></li>`).join("") : `<li class="is-empty">ยังไม่มีใครเริ่ม</li>`;
  tickClock();
  overlay();
}

function canPress() {
  const { s, me } = st; if (!s || !me || me.banned) return false;
  const mine = s.sides[me.side];
  return !mine.locked && !mine.full && !mine.spent && me.energy > 0 && st.up;
}

function tickClock() {
  const { s, me } = st; if (!s || !me || st.screen !== "main") return;
  const next = $("[data-next]");
  if (next) next.textContent = me.nextAt ? `แรงถัดไปใน ${mmss(me.nextAt - net.now())}` : "แรงเต็ม";
  const t = $("[data-timer]");
  if (t && s.phase.endsAt) { const left = s.phase.endsAt - net.now(); t.textContent = mmss(left); t.classList.toggle("is-low", left < 6000); }
}
setInterval(tickClock, 250);

/* ---------- the round overlay: vote, roll, result ---------- */
function clearDice() { for (const d of st.dice) d.destroy(); st.dice = []; }

function overlay() {
  const { s, me } = st, p = s.phase, el = $("[data-overlay]"); if (!el) return;
  const key = p.kind === "idle" ? null : p.kind === "vote" ? `vote:${p.options.join()}` : p.card ? `dark:${p.card}` : `light:${p.boon}`;
  if (key !== st.overlay) {
    st.overlay = key; st.peek = null; clearDice();
    el.hidden = !key; el.className = `gw-overlay${key ? ` is-${p.side}` : ""}`;
    if (!key) { el.innerHTML = ""; return; }
    if (p.kind === "vote") el.innerHTML = voteHtml(p);
    else if (p.card) {
      el.innerHTML = roundHtml(p);
      const row = $(".gw-dice", el);
      for (let i = 0; i < p.rollers.length; i++) {
        const slot = document.createElement("div"); slot.className = "gw-slot"; slot.innerHTML = `<div class="gw-slot-die"></div><span></span>`;
        const d = new Die("trauma", 6); $(".gw-slot-die", slot).appendChild(d.el); row.appendChild(slot);
        if (p.rollers[i].value != null) d.show(p.rollers[i].value);   // joined late: no replay
        st.dice.push(d);
      }
    } else el.innerHTML = boonHtml(p);
  }
  if (p.kind === "vote") updateVote(p);
  else if (p.card) updateRound(p);
}

function voteHtml(p) {
  const mine = p.side === st.me.side, dark = p.side === "dark";
  const opts = p.options.map((id) => {
    if (dark) return `<button type="button" class="gw-opt" data-vote="${id}">${cardHtml(id, { compact: true })}<div class="gw-opt-meter"><i data-meter="${id}"></i></div><span data-votes="${id}"></span></button>`;
    const b = boonById(id);
    return `<button type="button" class="gw-opt is-boon" data-vote="${id}" ${mine ? "" : "disabled"}><b>${esc(b.th.name)}</b><p>${esc(b.th.effect)}</p><div class="gw-opt-meter"><i data-meter="${id}"></i></div><span data-votes="${id}"></span></button>`;
  }).join("");
  return `
    <div class="gw-sheet">
      <div class="gw-kicker"><span>${dark ? "ห้วงลึกตื่น" : "แสงส่องลงมา"}</span></div>
      <h2>${mine ? (dark ? "เลือกชะตาของปาร์ตี้" : "เลือกพรให้ปาร์ตี้") : `ฝ่าย${SIDE[p.side].name}กำลังเลือก`}</h2>
      <div class="gw-timer" data-timer></div>
      <div class="gw-opts${dark ? "" : " is-boons"}">${opts}</div>
      ${dark ? `<div class="gw-detail" data-detail></div>` : ""}
      <p class="gw-note">${mine ? "แตะเพื่อโหวต เปลี่ยนใจได้จนกว่าเวลาจะหมด" : dark ? "รอบนี้ฝ่ายความมืดเป็นคนโหวต แตะการ์ดเพื่ออ่านได้" : "รอบนี้ฝ่ายแสงสว่างเป็นคนโหวต"}</p>
    </div>`;
}

function updateVote(p) {
  const total = Math.max(1, Object.values(p.tally).reduce((a, b) => a + b, 0));
  for (const id of p.options) {
    const m = $(`[data-meter="${id}"]`); if (m) m.style.width = pct(p.tally[id] / total);
    const v = $(`[data-votes="${id}"]`); if (v) v.textContent = `${p.tally[id]} เสียง`;
    const b = $(`[data-vote="${id}"]`); b?.classList.toggle("on", st.me.vote === id); b?.classList.toggle("is-peek", st.peek === id);
  }
  const det = $("[data-detail]");
  if (det) {
    const c = cardById(p.options.includes(st.peek) ? st.peek : st.me.vote);
    det.innerHTML = c ? `<b>${esc(c.th.name)}</b><p>${esc(c.th.board)}</p><p class="is-symptom">${esc(c.th.symptom)}</p>` : `<em>แตะการ์ดเพื่ออ่านว่าจะเกิดอะไรขึ้น</em>`;
  }
}

function roundHtml(p) {
  return `
    <div class="gw-sheet">
      <div class="gw-kicker"><span>ห้วงลึกเลือกแล้ว</span></div>
      <div class="gw-round-card">${cardHtml(p.card)}</div>
      <h2 data-title></h2>
      <div class="gw-timer" data-timer></div>
      <div class="gw-dice"></div>
      <p class="gw-values" data-values hidden></p>
      <button type="button" class="gw-go gw-roll" data-roll hidden>ทอยเต๋า Trauma</button>
      <p class="gw-note" data-note></p>
    </div>`;
}

function updateRound(p) {
  const el = $("[data-overlay]"), done = p.kind === "result", mine = st.me.roller >= 0;
  $("[data-title]", el).textContent = done ? "ห้วงลึกตัดสินแล้ว" : mine ? "คุณคือผู้กระซิบเอก" : "ผู้กระซิบเอกกำลังทอย";
  $("[data-timer]", el).hidden = done;
  const btn = $("[data-roll]", el); btn.hidden = done || !mine;
  p.rollers.forEach((r, i) => {
    const d = st.dice[i], slot = d?.el.closest(".gw-slot"); if (!d) return;
    $("span", slot).textContent = r.name ?? "ห้วงลึก";
    slot.classList.toggle("is-waiting", r.value == null);
    if (r.value != null && d.value == null) { d.roll(r.value, { dur: 1.3 }).then(() => st.fx?.at(d.el, "ember", 16)); navigator.vibrate?.(20); }
  });
  const vals = $("[data-values]", el); vals.hidden = !done; if (done) vals.textContent = p.values.join(" · ");
  $("[data-note]", el).textContent = done ? "แต้มนี้ถูกส่งไปสู้กับเต๋าสติของผู้เล่นแล้ว ถ้าเสมอ ความมืดชนะ" : mine ? "แตะปุ่มเพื่อทอย ถ้าไม่ทันเวลา ห้วงลึกจะทอยแทน" : "คนที่ส่งแรงมากที่สุดในรอบนี้ได้ทอยเต๋าสู้กับผู้เล่น";
}

function boonHtml(p) {
  const b = boonById(p.boon);
  return `
    <div class="gw-sheet is-boon-result">
      <div class="gw-boon-art">${sigil("light")}</div>
      <div class="gw-kicker"><span>แสงส่องลงมา</span></div>
      <h2 class="gw-boon-name">${esc(b.th.name)}</h2>
      <p class="gw-boon-effect">${esc(b.th.effect)}</p>
      <p class="gw-note">${esc(b.th.told)}</p>
    </div>`;
}

/* ---------- input ---------- */
app.addEventListener("input", (ev) => {
  if (ev.target.id === "gw-name") { st.draft.name = ev.target.value; update(); }
});
app.addEventListener("keydown", (ev) => { if (ev.target.id === "gw-name" && ev.key === "Enter") ev.target.blur(); });

app.addEventListener("click", (ev) => {
  const b = ev.target.closest("button"); if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.side) {
    st.draft.side = d.side;
    for (const x of app.querySelectorAll(".gw-side")) x.classList.toggle("on", x.dataset.side === d.side);
    return update();
  }
  if ("join" in d) {
    const name = st.draft.name.trim(); if (!name || !st.draft.side) return;
    try { localStorage.setItem("grim-whispers-name", name); } catch { /* no storage */ }
    st.joining = true; update();
    if (!net.send({ t: "join", name, side: st.draft.side })) { st.joining = false; toast("ยังเชื่อมต่อไม่ได้ ลองอีกครั้ง"); update(); }
    return;
  }
  if (d.vote) {
    const p = st.s.phase; st.peek = d.vote;
    if (p.side === st.me.side && net.send({ t: "vote", option: d.vote })) { st.me.vote = d.vote; navigator.vibrate?.(10); }
    return updateVote(p);
  }
  if ("roll" in d) { b.hidden = true; net.send({ t: "roll" }); navigator.vibrate?.(30); }
});

// The press button answers on pointerdown, so fast tapping feels immediate.
app.addEventListener("pointerdown", (ev) => {
  const b = ev.target.closest("[data-press]"); if (!b) return;
  ev.preventDefault();
  if (!canPress()) {
    const { s, me } = st, mine = s?.sides[me?.side];
    if (mine && !mine.full && !mine.locked && !mine.spent && me.energy <= 0) toast(WHY.energy);
    b.classList.remove("is-deny"); void b.offsetWidth; b.classList.add("is-deny");
    return;
  }
  if (!net.send({ t: "whisper" })) return;
  // show the result at once; the server's answer follows and corrects it if needed
  st.me.energy--; st.me.contrib++;
  if (st.me.nextAt == null) st.me.nextAt = net.now() + st.s.regenMs;
  const mine = st.s.sides[st.me.side]; mine.gauge = Math.min(mine.target, mine.gauge + 1);
  update();
  b.classList.remove("is-hit"); void b.offsetWidth; b.classList.add("is-hit");
  const r = b.getBoundingClientRect();
  st.fx?.burst(SIDE[st.me.side].fx, r.left + r.width / 2, r.top + r.height / 2, r.width * 0.5, 14);
  navigator.vibrate?.(12);
});
