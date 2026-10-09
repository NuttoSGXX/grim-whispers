// Grim Whispers: one WebSocket that reconnects by itself. Shared by the viewer page and the GM console.
const KEY = "grim-whispers-token";
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* private window: the token lasts for this page only */ } };

export class Net {
  /** @param h { onState(s, me, gm), onMe(me), onMsg(m), onLink(up) }   @param gmKey  GM secret, or null for a viewer */
  constructor(h, gmKey = null) {
    this.h = h; this.gmKey = gmKey; this.token = read(); this.ws = null; this.delay = 500; this.offset = 0; this.up = false;
    this.connect();
    document.addEventListener("visibilitychange", () => { if (!document.hidden && !this.up) this.connect(true); });
  }

  /** Server time, so countdowns agree on every screen. */
  now() { return Date.now() + this.offset; }

  connect(now = false) {
    clearTimeout(this.timer);
    if (this.ws && this.ws.readyState <= 1) return;
    if (!now && document.hidden) return;
    const ws = this.ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
    ws.onopen = () => { this.delay = 500; this.send({ t: "hello", token: this.token ?? undefined, gm: this.gmKey ?? undefined }); };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === "welcome") { this.token = m.token; write(m.token); this.up = true; this.h.onLink?.(true); this.h.onMsg?.(m); }
      else if (m.t === "state") { this.offset = m.s.now - Date.now(); this.h.onState?.(m.s, m.me, m.gm); }
      else if (m.t === "me") this.h.onMe?.(m.me);
      else this.h.onMsg?.(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.up = false; this.h.onLink?.(false);
      this.timer = setTimeout(() => this.connect(), this.delay);
      this.delay = Math.min(8000, this.delay * 1.7);
    };
    ws.onerror = () => {};
  }

  send(m) { if (this.ws?.readyState === 1) { this.ws.send(JSON.stringify(m)); return true; } return false; }
}
