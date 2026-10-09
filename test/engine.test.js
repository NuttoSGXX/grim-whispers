import assert from "node:assert/strict";
import { Engine } from "../server/engine.js";

let t = 1_000_000; let seq = [];
const rand = () => (seq.length ? seq.shift() : 0.5);
const mk = (cfg) => new Engine({ now: () => t, rand, cfg });
const add = (e, id, side) => { assert.ok(e.join(id, "V" + id, side).ok); e.online(id, 1); };

// --- joining
let e = mk();
assert.equal(e.join("a", "  ", "dark").ok, false);
assert.equal(e.join("a", "A", "purple").ok, false);
assert.equal(e.join("a", "<b>Ann</b>" + "x".repeat(40), "dark").viewer.name.length, 20);
assert.equal(e.join("a", "Ann", "light").viewer.side, "dark");          // side cannot change by rejoining
e.online("a", 1); e.online("a", 1); e.online("a", -1); assert.equal(e.members("dark"), 1);   // two tabs, one closes
e.online("a", -1); assert.equal(e.members("dark"), 0);

// --- energy and gauge
e = mk(); add(e, "d1", "dark"); add(e, "d2", "dark"); add(e, "l1", "light");
assert.equal(e.whisper("d1").why, "locked");
e.lock("both", false);
assert.equal(e.target("dark"), 40); assert.equal(e.target("light"), 20);
for (let i = 0; i < 5; i++) assert.ok(e.whisper("d1").ok);
assert.equal(e.whisper("d1").why, "energy");
assert.equal(e.privateState("d1").energy, 0); assert.equal(e.privateState("d1").nextAt, t + 30000);
t += 29999; assert.equal(e.whisper("d1").why, "energy");
t += 1; assert.ok(e.whisper("d1").ok);
t += 95000; assert.equal(e.privateState("d1").energy, 3);                 // 3 full periods, remainder kept
t += 25000; assert.equal(e.privateState("d1").energy, 4);
t += 10 * 60000; assert.equal(e.privateState("d1").energy, 5);            // capped
assert.equal(e.side.dark.gauge, 6); assert.equal(e.side.light.gauge, 0);  // gauges are separate
assert.equal(e.whisper("nobody").why, "unknown");

// --- target only grows within a round
e.online("d2", -1); assert.equal(e.target("dark"), 40);

// --- fill, vote, roll
e = mk({ minTarget: 4, perViewer: 2 }); add(e, "d1", "dark"); add(e, "d2", "dark"); add(e, "d3", "dark"); add(e, "l1", "light"); e.lock("both", false);
assert.equal(e.target("dark"), 6);
assert.equal(e.startVote("dark").why, "notfull");
for (let i = 0; i < 3; i++) e.whisper("d1"); for (let i = 0; i < 2; i++) e.whisper("d2");
assert.equal(e.whisper("d3").full, true);
assert.equal(e.whisper("d3").why, "full");
assert.equal(e.privateState("d3").energy, 4);                              // a refused press costs nothing
e.setDeck({ off: {}, suits: {}, cap: 3 });
seq = Array(40).fill(0.999);                                               // shuffle keeps order: first three cards
assert.ok(e.startVote("dark").ok);
let p = e.publicState().phase; assert.equal(p.kind, "vote"); assert.equal(p.options.length, 3);
assert.equal(e.startVote("light", { force: true }).why, "busy");
assert.equal(e.vote("l1", p.options[0]).why, "side");                      // only the side that filled its gauge votes
assert.equal(e.vote("d1", "nope").why, "option");
const drums = "deep-drums";                                                // trauma 2
assert.ok(p.options.includes(drums));
e.vote("d1", p.options[0]); e.vote("d1", drums); e.vote("d2", drums); e.vote("d3", p.options[0]);
assert.equal(e.publicState().phase.tally[drums], 2);
t += 60000; e.tick();
p = e.publicState().phase; assert.equal(p.kind, "roll"); assert.equal(p.card, drums); assert.equal(p.rollers.length, 2);
assert.deepEqual(p.rollers.map((r) => r.name), ["Vd1", "Vd2"]);            // top whisperers roll
assert.equal(e.side.dark.gauge, 0); assert.equal(e.side.dark.fills, 1);
assert.equal(e.viewers.get("d1").score, 1); assert.equal(e.viewers.get("d3").score, 0);
assert.equal(e.privateState("d1").roller, 0); assert.equal(e.privateState("d3").roller, -1);
assert.equal(e.roll("d3").why, "notyours");
seq = [0.99]; assert.equal(e.roll("d1").value, 6); assert.equal(e.roll("d1").why, "notyours");
seq = [0.0]; t += 15000; e.tick();                                         // d2 never clicked: rolled for them
p = e.publicState().phase; assert.equal(p.kind, "result"); assert.deepEqual(p.values, [6, 1]); assert.equal(p.rollers[1].auto, true);
assert.equal(e.whisper("d1").ok, true);                                    // gauges keep filling while the result is up
assert.ok(e.clear().ok); assert.equal(e.publicState().phase.kind, "idle");
assert.equal(e.target("dark"), Math.round(6 * 1.25));                      // next round is harder

// --- cancelling a vote keeps the gauge
e = mk({ minTarget: 2, perViewer: 2 }); add(e, "l1", "light"); e.lock("both", false); e.whisper("l1"); e.whisper("l1");
assert.ok(e.startVote("light").ok); e.clear(); assert.equal(e.side.light.gauge, 2); assert.equal(e.side.light.fills, 0);
// --- light round ends in a boon, no dice
assert.ok(e.startVote("light").ok); const lo = e.publicState().phase.options; e.vote("l1", lo[1]); e.endVote();
p = e.publicState().phase; assert.equal(p.kind, "result"); assert.equal(p.boon, lo[1]); assert.equal(p.values, null);
e.clear();
// --- sealed deck, single open card, fill limit
e.setDeck({ preset: "sealed" }); assert.equal(e.startVote("dark", { force: true }).why, "sealed");
e.setDeck({ preset: "travel" }); for (const c of ["two-voices", "deep-drums", "frenzied-herd", "two-headed-shadow", "bloom", "roots-beneath", "drowsing-spores", "brides-song", "dripping-ceiling", "liquid-floor", "lightswallow"]) e.toggleCard(c);
seq = [0.5]; assert.ok(e.startVote("dark", { force: true }).ok);           // one card: no vote; no dark whisperers: the abyss rolls all three
p = e.publicState().phase; assert.equal(p.kind, "result"); assert.equal(p.card, "faceless-thing"); assert.equal(p.values.length, 3); assert.ok(p.rollers.every((r) => r.auto));
e.clear(); e.setFills("light", 3); assert.equal(e.whisper("l1").why, "spent");
// --- ban, snapshot
e.ban("l1"); assert.equal(e.whisper("l1").why, "unknown"); assert.equal(e.members("light"), 0);
const snap = JSON.parse(JSON.stringify(e.snapshot())); const e2 = mk(); assert.ok(e2.restore(snap));
assert.equal(e2.viewers.get("l1").banned, true); assert.equal(e2.side.light.fills, 3); assert.equal(e2.members("light"), 0); assert.equal(e2.deck.off["bloom"], true);
// --- new session
e2.newSession(); assert.equal(e2.side.light.fills, 0); assert.equal(e2.side.dark.locked, true); assert.equal(e2.viewers.size, 1);
console.log("engine ok");
