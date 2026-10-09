// Grim Whispers: HTTP + WebSocket server. One process, one stream.
//   PORT       port to listen on (default 3000)
//   GM_KEY     secret for the GM console and, later, the Foundry bridge
//   DATA_FILE  where state is saved between restarts (default data/state.json)
//   GOOGLE_CLIENT_ID  turns on "Sign in with Google"; viewers must then sign in to join
//   ALLOW_GUESTS=1    with Google sign-in on, still let people join with just a name
//   SESSION_SECRET    signs viewers' session tokens (made and kept in the data folder if unset)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { Engine } from "./engine.js";
import { makeVerifier } from "./google.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, "data", "state.json");
let GM_KEY = process.env.GM_KEY || "";
const KEY_FROM_ENV = !!GM_KEY;
if (!GM_KEY) {
  GM_KEY = crypto.randomBytes(9).toString("base64url");
  console.log(`[grim-whispers] GM_KEY is not set. Using a one-time key for this run: ${GM_KEY}`);
}

const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();
const LOGIN_REQUIRED = !!GOOGLE_CLIENT_ID && process.env.ALLOW_GUESTS !== "1";
const verifyGoogle = GOOGLE_CLIENT_ID ? makeVerifier({ clientId: GOOGLE_CLIENT_ID }) : null;

// Session tokens are "s.<viewer id>.<signature>": the server can check one without storing it.
let SESSION_SECRET = process.env.SESSION_SECRET || "";
if (!SESSION_SECRET) {
  const f = path.join(path.dirname(DATA_FILE), "session.key");
  try { SESSION_SECRET = fs.readFileSync(f, "utf8").trim(); } catch { /* first run */ }
  if (!SESSION_SECRET) {
    SESSION_SECRET = crypto.randomBytes(32).toString("base64url");
    try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, SESSION_SECRET, { mode: 0o600 }); } catch (e) { console.warn("[grim-whispers] could not keep the session key; sign-ins will not survive a restart:", e.message); }
  }
}
const sign = (id) => crypto.createHmac("sha256", SESSION_SECRET).update(id).digest("base64url").slice(0, 32);
const sessionFor = (id) => `s.${id}.${sign(id)}`;
function idFromSession(token) {
  const m = /^s\.([\w-]{6,40})\.([\w-]{32})$/.exec(token ?? ""); if (!m) return null;
  const a = Buffer.from(m[2]), b = Buffer.from(sign(m[1]));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? m[1] : null;
}

const engine = new Engine();
try { if (fs.existsSync(DATA_FILE) && engine.restore(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")))) console.log(`[grim-whispers] restored ${engine.viewers.size} viewers`); }
catch (e) { console.warn("[grim-whispers] could not read saved state:", e.message); }

/* ---------- static files ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8" };
const ROUTES = { "/": "index.html", "/dm": "dm.html", "/overlay": "overlay.html" };

function serve(req, res) {
  let url;
  try { url = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end(); return; }
  if (url === "/healthz") { res.writeHead(200, { "content-type": "text/plain" }).end("ok"); return; }
  if (url === "/config.json") { res.writeHead(200, { "content-type": "application/json", "cache-control": "no-cache" }).end(JSON.stringify({ googleClientId: GOOGLE_CLIENT_ID || null, loginRequired: LOGIN_REQUIRED })); return; }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
  let file;
  if (ROUTES[url]) file = path.join(PUBLIC, ROUTES[url]);
  else if (url === "/shared/cards.js") file = path.join(ROOT, "shared", "cards.js");
  else file = path.join(PUBLIC, path.normalize(url));
  if (!file.startsWith(PUBLIC + path.sep) && !file.startsWith(path.join(ROOT, "shared") + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "content-type": "text/plain" }).end("Not found"); return; }
    const ext = path.extname(file);
    res.writeHead(200, {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": ext === ".woff2" ? "public, max-age=604800" : "no-cache",
      "x-content-type-options": "nosniff", "referrer-policy": "no-referrer"
    });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}

const server = http.createServer(serve);
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 4096 });

/* ---------- connections ---------- */
const idOf = (token) => crypto.createHash("sha256").update(token).digest("base64url").slice(0, 14);
const sameKey = (k) => { const a = Buffer.from(String(k ?? "")), b = Buffer.from(GM_KEY); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };

function pushTo(ws) {
  send(ws, { t: "state", s: engine.publicState(), me: ws.vid ? engine.privateState(ws.vid) : null, gm: ws.gm ? engine.gmState() : undefined });
}

let sentRev = -1;
function flush() {
  engine.tick();
  if (engine.rev === sentRev) return;
  sentRev = engine.rev;
  const pub = engine.publicState(), gm = [...wss.clients].some((c) => c.gm) ? engine.gmState() : null;
  for (const ws of wss.clients) send(ws, { t: "state", s: pub, me: ws.vid ? engine.privateState(ws.vid) : null, gm: ws.gm ? gm : undefined });
}
setInterval(flush, 200);

wss.on("connection", (ws) => {
  ws.alive = true; ws.vid = null; ws.uid = null; ws.gm = false; ws.google = false; ws.profile = ""; ws.count = 0; ws.since = Date.now();
  ws.on("pong", () => { ws.alive = true; });
  ws.on("close", () => { if (ws.vid) engine.online(ws.vid, -1); });
  ws.on("error", () => {});
  ws.on("message", (raw) => {
    // at most 40 messages every 2 seconds from one connection
    const now = Date.now();
    if (now - ws.since > 2000) { ws.since = now; ws.count = 0; }
    if (++ws.count > 40) { ws.close(1008, "slow down"); return; }
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== "string") return;
    Promise.resolve().then(() => handle(ws, m)).catch((e) => console.warn("[grim-whispers] message failed:", e));
  });
});

function attach(ws, id) {
  if (ws.vid && ws.vid !== id) { engine.online(ws.vid, -1); ws.vid = null; }
  ws.uid = id;                                  // who this connection is, joined or not
  if (ws.vid !== id && engine.viewers.has(id)) { ws.vid = id; engine.online(id, 1); }
}

async function handle(ws, m) {
  if (m.t === "hello") {
    if (m.gm != null) ws.gm = sameKey(m.gm);
    const base = { gm: ws.gm, gmDenied: m.gm != null && !ws.gm };
    // 1. a fresh Google sign-in
    if (typeof m.google === "string" && verifyGoogle) {
      let who;
      try { who = await verifyGoogle(m.google); }
      catch (e) { send(ws, { t: "welcome", ...base, needLogin: true, loginError: true }); return; }
      const id = "g" + crypto.createHash("sha256").update(`google:${who.sub}`).digest("base64url").slice(0, 13);
      ws.google = true; ws.profile = who.name;
      attach(ws, id);
      send(ws, { t: "welcome", ...base, token: sessionFor(id), name: who.name, google: true });
      pushTo(ws); return;
    }
    // 2. a session this server issued earlier
    const sid = idFromSession(m.token);
    if (sid) {
      ws.google = sid.startsWith("g");
      if (ws.google || !LOGIN_REQUIRED) { attach(ws, sid); send(ws, { t: "welcome", ...base, token: m.token, google: ws.google }); pushTo(ws); return; }
    }
    // 3. nobody yet
    if (LOGIN_REQUIRED) { ws.uid = null; send(ws, { t: "welcome", ...base, needLogin: true }); pushTo(ws); return; }
    const id = "a" + crypto.randomBytes(10).toString("base64url").slice(0, 13);
    ws.google = false;
    attach(ws, id);
    send(ws, { t: "welcome", ...base, token: sessionFor(id), google: false });
    pushTo(ws);
    return;
  }
  if (m.t === "join") {
    if (!ws.uid) { send(ws, { t: "joined", ok: false, why: "login" }); return; }
    const id = ws.uid, had = engine.viewers.has(id);
    const r = engine.join(id, m.name || ws.profile, m.side, { google: !!ws.google });
    if (r.ok && ws.vid !== id) { ws.vid = id; engine.online(id, 1); }
    send(ws, { t: "joined", ok: r.ok, why: r.why, again: had });
    pushTo(ws);
    return;
  }
  if (m.t === "whisper" || m.t === "vote" || m.t === "roll" || m.t === "choose") {
    if (!ws.vid) return;
    const r = m.t === "whisper" ? engine.whisper(ws.vid) : m.t === "vote" ? engine.vote(ws.vid, String(m.option ?? "")) : m.t === "choose" ? engine.choose(ws.vid, String(m.option ?? "")) : engine.roll(ws.vid);
    if (!r.ok) send(ws, { t: "no", a: m.t, why: r.why });
    send(ws, { t: "me", me: engine.privateState(ws.vid) });   // answer the presser at once; everyone else gets the next flush
    return;
  }
  if (m.t === "gm") {
    if (!ws.gm) { send(ws, { t: "no", a: "gm", why: "denied" }); return; }
    const r = gm(m);
    send(ws, { t: "gmack", a: m.a, ok: r.ok, why: r.why });
    flush();
  }
}

function gm(m) {
  switch (m.a) {
    case "lock": return engine.lock(m.side, m.locked);
    case "startVote": return engine.startVote(m.side, { force: !!m.force });
    case "endVote": return engine.endVote(m.pick ?? null);
    case "endRoll": return engine.endRoll();
    case "clear": return engine.clear();
    case "nudge": return engine.nudge(m.side, Number(m.delta) || 0);
    case "setFills": return engine.setFills(m.side, Number(m.n) || 0);
    case "setCfg": return engine.setCfg(m.cfg ?? {});
    case "setDeck": return engine.setDeck(m.deck ?? {});
    case "setScene": return engine.setScene(String(m.scene ?? ""));
    case "setLight": return engine.setLight(m.light ?? {});
    case "give": return engine.give(m.id, m.level);
    case "revoke": return engine.revoke(m.id);
    case "playQueued": return engine.playQueued(m.qid);
    case "dropQueued": return engine.dropQueued(m.qid);
    case "toggleCard": return engine.toggleCard(m.id);
    case "toggleBoon": return engine.toggleBoon(m.id);
    case "ban": return engine.ban(m.id, m.banned !== false);
    case "newSession": return engine.newSession({ wipe: !!m.wipe });
    default: return { ok: false, why: "unknown" };
  }
}

/* ---------- housekeeping ---------- */
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
}, 30000);

let savedRev = engine.rev;
function save() {
  if (engine.rev === savedRev) return;
  savedRev = engine.rev;
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE + ".tmp", JSON.stringify(engine.snapshot()));
    fs.renameSync(DATA_FILE + ".tmp", DATA_FILE);
  } catch (e) { console.warn("[grim-whispers] could not save state:", e.message); }
}
setInterval(save, 15000);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { save(); process.exit(0); });

server.listen(PORT, () => {
  console.log(`[grim-whispers] viewers:  http://localhost:${PORT}/   (${GOOGLE_CLIENT_ID ? (LOGIN_REQUIRED ? "Google sign-in required" : "Google sign-in or guest") : "guests, no sign-in"})`);
  console.log(`[grim-whispers] overlay:  http://localhost:${PORT}/overlay   (OBS browser source)`);
  console.log(`[grim-whispers] GM:       http://localhost:${PORT}/dm#key=${KEY_FROM_ENV ? "<your GM_KEY>" : GM_KEY}`);   // a key from the environment is never printed
});
