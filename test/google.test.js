import assert from "node:assert/strict";
import crypto from "node:crypto";
import { makeVerifier } from "../server/google.js";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const make = (body, { key = privateKey, kid = "k1", alg = "RS256" } = {}) => {
  const data = `${b({ alg, kid, typ: "JWT" })}.${b(body)}`;
  return `${data}.${crypto.sign("RSA-SHA256", Buffer.from(data), key).toString("base64url")}`;
};
let now = 1_700_000_000_000, calls = 0;
const verify = makeVerifier({ clientId: "site.apps.googleusercontent.com", now: () => now, getCerts: async () => { calls++; return { keys: [jwk], ttl: 3600_000 }; } });
const good = { iss: "https://accounts.google.com", aud: "site.apps.googleusercontent.com", sub: "12345", given_name: "Thapanapong", exp: now / 1000 + 3600, iat: now / 1000 };
const bad = async (token, why) => assert.rejects(() => verify(token), (e) => { assert.match(e.message, why); return true; });

assert.deepEqual(await verify(make(good)), { sub: "12345", name: "Thapanapong", picture: null });
await verify(make(good)); assert.equal(calls, 1);                                   // keys are cached
await bad(make({ ...good, aud: "someone-else" }), /audience/);                      // a token made for another site
await bad(make({ ...good, iss: "https://evil.example" }), /issuer/);
await bad(make({ ...good, exp: now / 1000 - 3600 }), /expired/);
await bad(make(good, { key: other.privateKey }), /signature/);                      // signed by someone who is not Google
await bad(make(good, { kid: "nope" }), /unknown key/);
await bad(make(good, { alg: "none" }), /alg/);
const [h, p, s] = make(good).split(".");
await bad(`${h}.${b({ ...good, sub: "99999" })}.${s}`, /signature/);                // body changed after signing
await bad("not-a-token", /bad token/);
await bad(make({ ...good, sub: "" }), /subject/);
now += 2 * 3600_000; await bad(make(good), /expired/); assert.equal(calls > 1, true);
console.log("google ok");
