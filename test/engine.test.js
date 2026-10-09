import assert from "node:assert/strict";
import { Engine } from "../server/engine.js";

let t = 1_000_000; let seq = [];
const rand = () => (seq.length ? seq.shift() : 0.5);
const mk = (cfg) => new Engine({ now: () => t, rand, cfg });
const add = (e, id, side) => { assert.ok(e.join(id, "V" + id, side).ok); e.online(id, 1); };
const press = (e, id, n) => { for (let i = 0; i < n; i++) e.whisper(id); };

// --- joining
let e = mk();
assert.equal(e.join("a", "  ", "dark").ok, false);
assert.equal(e.join("a", "A", "purple").ok, false);
assert.equal(e.join("a", "<b>Ann</b>" + "x".repeat(40), "dark").viewer.name.length, 20);
assert.equal(e.join("a", "Ann", "light").viewer.side, "dark");          // side cannot change by rejoining
e.online("a", 1); e.online("a", 1); e.online("a", -1); assert.equal(e.members("dark"), 1);
e.online("a", -1); assert.equal(e.members("dark"), 0);

// --- energy: adjustable size and refill time
e = mk({ balance: false }); add(e, "d1", "dark"); add(e, "d2", "dark"); add(e, "l1", "light");
assert.equal(e.whisper("d1").why, "locked"); e.lock("both", false);
assert.equal(e.target("dark"), 40); assert.equal(e.target("light"), 40);      // both sides aim at the same size
press(e, "d1", 5); assert.equal(e.whisper("d1").why, "energy");
assert.equal(e.privateState("d1").nextAt, t + 30000);
t += 30000; assert.ok(e.whisper("d1").ok);
e.setCfg({ regenMs: 10000, energyMax: 8 }); t += 35000; assert.equal(e.privateState("d1").energy, 3);
t += 600000; assert.equal(e.privateState("d1").energy, 8);
e.setCfg({ energyMax: 3 }); assert.equal(e.privateState("d1").energy, 3);     // shrinking the pool trims what is banked
assert.equal(e.side.dark.gauge, 6);

// --- gauge size: fixed pool, or growing with viewers
e = mk({ perViewer: 0, pool: 50 }); add(e, "d1", "dark"); for (let i = 0; i < 9; i++) add(e, "x" + i, "dark");
assert.equal(e.target("dark"), 50); e.setCfg({ pool: 30 }); assert.equal(e.target("dark"), 30);
e.setCfg({ perViewer: 4 }); assert.equal(e.target("dark"), 40);               // 10 viewers x 4 beats the pool of 30

// --- balance: 10 against 3
e = mk({ perViewer: 0, pool: 100 }); for (let i = 0; i < 10; i++) add(e, "d" + i, "dark"); for (let i = 0; i < 3; i++) add(e, "l" + i, "light"); e.lock("both", false);
assert.equal(e.weight("dark"), 1); assert.equal(e.weight("light"), 3.3);
for (let i = 0; i < 10; i++) press(e, "d" + i, 5); for (let i = 0; i < 3; i++) press(e, "l" + i, 5);
assert.equal(e.side.dark.gauge, 50); assert.ok(Math.abs(e.side.light.gauge - 49.5) < 1e-6);   // 50 presses vs 15 presses, nearly level
assert.equal(e.publicState().sides.light.gauge, 49.5); assert.equal(e.publicState().sides.light.weight, 3.3);
e.setCfg({ balanceCap: 2 }); assert.equal(e.weight("light"), 2);
e.setCfg({ balance: false }); assert.equal(e.weight("light"), 1);
e = mk(); add(e, "d1", "dark"); assert.equal(e.weight("dark"), 1);            // nobody on the other side: no bonus
e = mk(); for (let i = 0; i < 9; i++) add(e, "d" + i, "dark"); add(e, "l", "light"); assert.equal(e.weight("light"), 5);   // capped

// --- fill, vote, roll
e = mk({ pool: 6, perViewer: 0 }); add(e, "d1", "dark"); add(e, "d2", "dark"); add(e, "d3", "dark"); add(e, "l1", "light"); add(e, "l2", "light"); add(e, "l3", "light"); e.lock("both", false);
assert.equal(e.startVote("dark").why, "notfull");
press(e, "d1", 3); press(e, "d2", 2); assert.equal(e.whisper("d3").full, true); assert.equal(e.whisper("d3").why, "full");
assert.equal(e.privateState("d3").energy, 4);                                // a refused press costs nothing
e.setScene("all"); seq = Array(60).fill(0.999);
assert.ok(e.startVote("dark").ok);
let p = e.publicState().phase; assert.equal(p.options.length, 3);
assert.equal(e.vote("l1", p.options[0]).why, "side");
const drums = "deep-drums"; assert.ok(p.options.includes(drums));
e.vote("d1", drums); e.vote("d2", drums); e.vote("d3", p.options[0]);
t += 60000; e.tick();
p = e.publicState().phase; assert.equal(p.kind, "roll"); assert.deepEqual(p.rollers.map((r) => r.name), ["Vd1", "Vd2"]);
seq = [0.99]; assert.equal(e.roll("d1").value, 6); seq = [0.0]; t += 15000; e.tick();
p = e.publicState().phase; assert.deepEqual(p.values, [6, 1]); assert.equal(p.trauma, 2);
e.clear(); assert.equal(e.target("dark"), 8);                                 // 6 x 1.25, rounded

// --- scene: one switch sets both decks; boons have tiers
e.setScene("camp"); let s = e.publicState().sides; assert.equal(s.dark.open, 8); assert.equal(s.light.open, 7);
e.setLight({ cap: 1 }); assert.equal(e.publicState().sides.light.open, 3);
e.toggleBoon("warm-fire"); assert.equal(e.publicState().sides.light.open, 2);
e.setScene("sealed"); s = e.publicState().sides; assert.equal(s.dark.open, 0); assert.equal(s.light.open, 0);
assert.equal(e.startVote("light", { force: true }).why, "sealed");
e.setScene("social"); e.setLight({ cap: 3 }); seq = Array(40).fill(0.999);
assert.ok(e.startVote("light", { force: true }).ok); p = e.publicState().phase;
assert.ok(p.options.every((id) => ["kind-stranger", "overheard", "open-door", "heart-ward", "old-debt", "lifting-fog"].includes(id)));
e.vote("l1", p.options[1]); e.endVote(); p = e.publicState().phase; assert.equal(p.boon, p.boon); assert.equal(p.kind, "result"); assert.equal(p.values, null); e.clear();

// --- a pick given to one viewer (a donor)
e.setScene("travel");
assert.equal(e.give("nobody", 1).why, "unknown"); assert.equal(e.give("d3", 4).why, "level");
assert.equal(e.give("d3", 3).options, 3);                                     // three Trauma 3 cards are open while travelling
let me = e.privateState("d3"); assert.equal(me.gift.level, 3); assert.deepEqual(me.gift.options.sort(), ["brides-song", "faceless-thing", "two-headed-shadow"]);
e.setDeck({ ...e.deck, cap: 1, preset: null }); assert.equal(e.privateState("d3").gift.options.length, 3);   // the GM's cap does not take a paid level away
assert.equal(e.choose("d3", "deep-drums").why, "option");                    // not a level 3 card
assert.equal(e.choose("d1", "faceless-thing").why, "nogift");
assert.ok(e.choose("d3", "faceless-thing").ok); assert.equal(e.privateState("d3").gift, null);
assert.equal(e.gmState().queue.length, 1); assert.deepEqual(e.publicState().waiting, [{ name: "Vd3", side: "dark", level: 3 }]);
e.give("l2", 2); assert.ok(e.privateState("l2").gift.options.every((id) => ["abandoned-pack", "shortcut", "hidden-vials", "heart-ward"].includes(id)));
assert.ok(e.choose("l2", "shortcut").ok);
const fills = e.side.dark.fills, gauge = e.side.dark.gauge;
e.startVote("light", { force: true }); assert.equal(e.playQueued(e.gmState().queue[0].qid).why, "busy"); e.clear();
press(e, "d2", 1);
assert.ok(e.playQueued(e.gmState().queue[0].qid).ok);
p = e.publicState().phase; assert.equal(p.kind, "roll"); assert.equal(p.card, "faceless-thing"); assert.equal(p.by, "Vd3");
assert.equal(p.rollers[0].name, "Vd3"); assert.equal(p.rollers[1].name, "Vd2"); assert.equal(p.rollers[2].name, null);   // the giver rolls first
assert.equal(e.side.dark.fills, fills); assert.equal(e.side.dark.gauge, gauge + e.weight("dark"));   // gauges and fills untouched by a played pick
e.endRoll(); assert.equal(e.publicState().phase.by, "Vd3"); e.clear();
assert.ok(e.playQueued(e.gmState().queue[0].qid).ok); p = e.publicState().phase; assert.equal(p.kind, "result"); assert.equal(p.boon, "shortcut"); assert.equal(p.by, "Vl2"); e.clear();
e.give("d1", 1); e.revoke("d1"); assert.equal(e.privateState("d1").gift, null);
e.give("d1", 1); e.choose("d1", "bloom"); assert.ok(e.dropQueued(e.gmState().queue[0].qid).ok); assert.equal(e.gmState().queue.length, 0);

// --- ban, snapshot, new session
e.give("d2", 2); e.ban("l1"); assert.equal(e.whisper("l1").why, "unknown");
const snap = JSON.parse(JSON.stringify(e.snapshot())); const e2 = mk(); assert.ok(e2.restore(snap));
assert.equal(e2.viewers.get("l1").banned, true); assert.equal(e2.viewers.get("d2").gift.level, 2); assert.equal(e2.light.scene, "travel"); assert.equal(e2.cfg.pool, 6);
e2.newSession(); assert.equal(e2.side.dark.fills, 0); assert.equal(e2.viewers.get("d2").gift, null); assert.equal(e2.side.dark.locked, true);
console.log("engine ok");
