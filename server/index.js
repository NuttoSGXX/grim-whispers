// Grim Whispers: HTTP + WebSocket server. One process, one stream.
//   PORT       port to listen on (default 3000)
//   GM_KEY     secret for the GM console and, later, the Foundry bridge
//   DATA_FILE  where state is saved between restarts (default data/state.json)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { Engine } from "./engine.js";

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

const engine = new Engine();
try { if (fs.existsSync(DATA_FILE) && engine.restore(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")))) console.log(`[grim-whispers] restored ${engine.viewers.size} viewers`); }
catch (e) { console.warn("[grim-whispers] could not read saved state:", e.message); }

/* ---------- static files ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8" };
const ROUTES = { "/": "index.html", "/dm": "dm.html" };

function serve(req, res) {
  let url;
  try { url = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end(); return; }
  if (url === "/healthz") { res.writeHead(200, { "content-type": "text/plain" }).end("ok"); return; }
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
  ws.alive = true; ws.vid = null; ws.gm = false; ws.token = null; ws.count = 0; ws.since = Date.now();
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
    try { handle(ws, m); } catch (e) { console.warn("[grim-whispers] message failed:", e); }
  });
});

function handle(ws, m) {
  if (m.t === "hello") {
    // The token is the viewer's secret and lives in their browser; the public id is derived from it.
    const token = typeof m.token === "string" && /^[\w-]{16,64}$/.test(m.token) ? m.token : crypto.randomBytes(18).toString("base64url");
    const id = idOf(token);
    if (ws.vid && ws.vid !== id) engine.online(ws.vid, -1);
    if (ws.vid !== id && engine.viewers.has(id)) { ws.vid = id; engine.online(id, 1); }
    ws.token = token;
    if (m.gm != null) ws.gm = sameKey(m.gm);
    send(ws, { t: "welcome", token, gm: ws.gm, gmDenied: m.gm != null && !ws.gm });
    pushTo(ws);
    return;
  }
  if (m.t === "join") {
    if (!ws.token) return;
    const id = idOf(ws.token), had = engine.viewers.has(id);
    const r = engine.join(id, m.name, m.side);
    if (r.ok && ws.vid !== id) { ws.vid = id; engine.online(id, 1); }
    send(ws, { t: "joined", ok: r.ok, why: r.why, again: had });
    pushTo(ws);
    return;
  }
  if (m.t === "whisper" || m.t === "vote" || m.t === "roll") {
    if (!ws.vid) return;
    const r = m.t === "whisper" ? engine.whisper(ws.vid) : m.t === "vote" ? engine.vote(ws.vid, String(m.option ?? "")) : engine.roll(ws.vid);
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
  console.log(`[grim-whispers] viewers:  http://localhost:${PORT}/`);
  console.log(`[grim-whispers] GM:       http://localhost:${PORT}/dm#key=${KEY_FROM_ENV ? "<your GM_KEY>" : GM_KEY}`);   // a key from the environment is never printed
});
