// Grim Whispers: checks a "Sign in with Google" ID token without any extra dependency.
// The token is a JWT signed by Google (RS256). We check the signature against Google's
// published keys, then that it was issued for this site's client id and has not expired.
import crypto from "node:crypto";

const CERTS = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["accounts.google.com", "https://accounts.google.com"];
const b64 = (s) => Buffer.from(s, "base64url");

async function fetchCerts() {
  const r = await fetch(CERTS);
  if (!r.ok) throw new Error(`certs ${r.status}`);
  const age = Number(/max-age=(\d+)/.exec(r.headers.get("cache-control") ?? "")?.[1]) || 3600;
  return { keys: (await r.json()).keys ?? [], ttl: age * 1000 };
}

/** @param clientId  the OAuth client id of this site   @param getCerts  replaceable for tests */
export function makeVerifier({ clientId, getCerts = fetchCerts, now = () => Date.now() }) {
  let cache = { keys: [], until: 0 };
  async function keyFor(kid) {
    let k = cache.keys.find((x) => x.kid === kid);
    if (!k || now() > cache.until) {            // unknown key or stale list: ask Google again
      const c = await getCerts();
      cache = { keys: c.keys, until: now() + c.ttl };
      k = cache.keys.find((x) => x.kid === kid);
    }
    if (!k) throw new Error("unknown key");
    return crypto.createPublicKey({ key: k, format: "jwk" });
  }

  return async function verify(token) {
    if (typeof token !== "string" || token.length > 4096) throw new Error("bad token");
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("bad token");
    const head = JSON.parse(b64(parts[0])), body = JSON.parse(b64(parts[1]));
    if (head.alg !== "RS256") throw new Error("bad alg");
    const ok = crypto.verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), await keyFor(head.kid), b64(parts[2]));
    if (!ok) throw new Error("bad signature");
    if (body.aud !== clientId) throw new Error("wrong audience");
    if (!ISSUERS.includes(body.iss)) throw new Error("wrong issuer");
    const sec = now() / 1000;
    if (!(body.exp > sec - 30)) throw new Error("expired");
    if (body.iat && body.iat > sec + 300) throw new Error("not yet valid");
    if (!body.sub) throw new Error("no subject");
    return { sub: String(body.sub), name: String(body.given_name || body.name || "").slice(0, 40), picture: body.picture ?? null };
  };
}
