// Grim Sanity: vector art. Everything is drawn in code, so the module ships no image files
// beyond two small effect icons.

const PIPS = {
  1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9]
};
/** Inner markup of one d6 face: a 3x3 grid with pips in the usual places. */
export const pips = (value) => Array.from({ length: 9 }, (_, i) => `<i${PIPS[value]?.includes(i + 1) ? ' class="on"' : ""}></i>`).join("");

/** Jagged fracture lines for a die face, as a CSS background image. */
const CRACK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M52 0 46 18 58 31 44 47 55 62 41 78 50 100M46 18 26 24 12 14M58 31 79 37 100 30M44 47 22 55 0 50M55 62 76 72 88 92M41 78 24 86" stroke="#000" stroke-width="5" opacity=".85"/><path d="M52 0 46 18 58 31 44 47 55 62 41 78 50 100M46 18 26 24 12 14M58 31 79 37 100 30M44 47 22 55 0 50M55 62 76 72 88 92M41 78 24 86" stroke="#ff2a22" stroke-width="1.6"/></g></svg>`;
export const crackUrl = `url("data:image/svg+xml,${encodeURIComponent(CRACK)}")`;

const ring = (r, n, len, w = 1) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
  return `<line x1="${(100 + c * r).toFixed(1)}" y1="${(100 + s * r).toFixed(1)}" x2="${(100 + c * (r + len)).toFixed(1)}" y2="${(100 + s * (r + len)).toFixed(1)}" stroke-width="${w}"/>`;
}).join("");

const FRAME = `
  <g class="gsn-sg-ring" fill="none" stroke="currentColor">
    <circle cx="100" cy="100" r="92" stroke-width="1" opacity=".55"/>
    <circle cx="100" cy="100" r="84" stroke-width=".6" opacity=".4" stroke-dasharray="2 5"/>
    <g opacity=".6">${ring(86, 36, 5, 0.8)}</g>
    <g opacity=".9">${ring(84, 4, 9, 1.6)}</g>
  </g>`;

const ART = {
  // Frenzy: two heads sharing one stare.
  frenzy: `
    <g fill="none" stroke="currentColor" stroke-linecap="round">
      <g class="gsn-sg-spin" opacity=".55">${ring(58, 16, 14, 1)}</g>
      <path d="M100 38C70 38 52 62 52 92c0 22 12 38 26 50l6 24h32l6-24c14-12 26-28 26-50 0-30-18-54-48-54Z" stroke-width="1.4" opacity=".35"/>
      <circle cx="78" cy="92" r="24" stroke-width="2"/><circle cx="122" cy="92" r="24" stroke-width="2"/>
      <path d="M78 92c0-7 9-7 9 0s-15 9-15-2 20-14 22 0-16 22-28 12" stroke-width="1.6"/>
      <path d="M122 92c0-7-9-7-9 0s15 9 15-2-20-14-22 0 16 22 28 12" stroke-width="1.6"/>
      <path d="M88 132l6 12 6-10 6 10 6-12" stroke-width="1.6"/>
    </g>
    <circle cx="78" cy="92" r="3.4" fill="currentColor"/><circle cx="122" cy="92" r="3.4" fill="currentColor"/>`,
  // Spores: a cap that sheds upward.
  spores: `
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M44 112c0-36 24-62 56-62s56 26 56 62c-18 8-94 8-112 0Z" stroke-width="2"/>
      <path d="M60 106c4-22 18-38 40-42M100 64c22 4 36 20 40 42" stroke-width="1" opacity=".5"/>
      <path d="M84 118c-2 16-4 30-8 44h48c-4-14-6-28-8-44" stroke-width="2"/>
      <path d="M56 114c10 6 78 6 88 0" stroke-width="1" opacity=".6"/>
      <path d="M70 114v9M82 116v12M94 117v9M106 117v12M118 116v9M130 114v9" stroke-width="1" opacity=".7"/>
    </g>
    <g class="gsn-sg-rise" fill="currentColor">
      <circle cx="62" cy="44" r="2.2"/><circle cx="84" cy="30" r="1.6"/><circle cx="108" cy="36" r="2.4"/><circle cx="132" cy="28" r="1.5"/>
      <circle cx="146" cy="50" r="2"/><circle cx="74" cy="58" r="1.3" opacity=".7"/><circle cx="122" cy="52" r="1.3" opacity=".7"/><circle cx="98" cy="20" r="1.8" opacity=".8"/>
    </g>`,
  // Ooze: a drop with nothing looking back.
  ooze: `
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M100 30c18 30 42 50 42 80a42 42 0 0 1-84 0c0-30 24-50 42-80Z" stroke-width="2"/>
      <path d="M100 52c12 22 28 38 28 58a28 28 0 0 1-56 0c0-20 16-36 28-58Z" stroke-width="1" opacity=".45"/>
      <ellipse cx="100" cy="114" rx="18" ry="12" stroke-width="1.6"/>
      <path d="M78 150c2 8 2 14 0 20M100 154c2 10 2 16 0 24M122 150c2 8 2 12 0 16" stroke-width="1.6"/>
    </g>
    <ellipse cx="100" cy="114" rx="7" ry="11" fill="currentColor"/>
    <g class="gsn-sg-rise gsn-sg-fall" fill="currentColor"><circle cx="78" cy="176" r="2.4"/><circle cx="100" cy="184" r="2.8"/><circle cx="122" cy="172" r="2.2"/></g>`,
  // Doubt: a mask with someone else behind it.
  doubt: `
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M62 52c24-10 52-10 76 0v40c0 34-16 56-38 66-22-10-38-32-38-66Z" stroke-width="2"/>
      <path d="M72 62c18-7 38-7 56 0" stroke-width="1" opacity=".5"/>
      <path d="M72 88c8-8 18-8 24 0-6 6-18 6-24 0ZM104 88c6-8 16-8 24 0-8 6-18 6-24 0Z" stroke-width="1.8"/>
      <path d="M100 100v14M88 128c8 6 16 6 24 0" stroke-width="1.6"/>
      <path d="M100 44v114" stroke-width=".8" stroke-dasharray="3 5" opacity=".6"/>
      <g class="gsn-sg-spin" opacity=".45">${ring(66, 12, 10, 1)}</g>
    </g>
    <circle cx="116" cy="88" r="3" fill="currentColor"/>`,
  // Vigil: a low fire under a thin moon.
  vigil: `
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M124 36a26 26 0 1 0 22 40 22 22 0 0 1-22-40Z" stroke-width="1.6" opacity=".8"/>
      <path d="M100 152c-20 0-30-14-26-30 3-12 14-16 14-30 10 6 14 14 12 24 6-4 9-10 9-18 14 10 22 24 18 38-3 10-13 16-27 16Z" stroke-width="2"/>
      <path d="M100 150c-9 0-13-7-11-14 2-6 8-8 9-15 6 5 12 12 11 20-1 6-4 9-9 9Z" stroke-width="1.2" opacity=".7"/>
      <path d="M60 158l80 10M60 168l80-10" stroke-width="2.4"/>
    </g>
    <g class="gsn-sg-rise" fill="currentColor"><circle cx="84" cy="78" r="1.8"/><circle cx="112" cy="68" r="1.4"/><circle cx="96" cy="58" r="1.6" opacity=".7"/></g>`,
  // No card: the abyss itself.
  abyss: `
    <g fill="none" stroke="currentColor" stroke-linecap="round">
      <g class="gsn-sg-spin" opacity=".5">${ring(60, 24, 12, 1)}</g>
      <path d="M40 100c18-26 38-38 60-38s42 12 60 38c-18 26-38 38-60 38s-42-12-60-38Z" stroke-width="2"/>
      <circle cx="100" cy="100" r="24" stroke-width="1.6"/>
      <path d="M100 76v48M76 100h48" stroke-width=".8" opacity=".5"/>
    </g>
    <path d="M100 82c5 8 5 28 0 36-5-8-5-28 0-36Z" fill="currentColor"/>`,
  // Light: a sun with a calm centre.
  light: `
    <g fill="none" stroke="currentColor" stroke-linecap="round">
      <g class="gsn-sg-spin">${ring(44, 12, 26, 1.6)}</g>
      <g class="gsn-sg-spin" opacity=".5">${ring(40, 24, 14, 0.8)}</g>
      <circle cx="100" cy="100" r="30" stroke-width="2"/><circle cx="100" cy="100" r="18" stroke-width="1" opacity=".6"/>
    </g>
    <path d="M100 86l4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="currentColor"/>`
};

export const sigil = (kind) => `<svg class="gsn-sigil gsn-sigil-${kind}" viewBox="0 0 200 200" aria-hidden="true">${FRAME}${ART[kind] ?? ART.abyss}</svg>`;

/** Small dice for the party strip. */
export const miniD6 = `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="top" d="M12 2.2 21 7 12 11.8 3 7Z"/><path class="left" d="M3 7 12 11.8V21.8L3 17Z"/><path class="right" d="M21 7 12 11.8V21.8L21 17Z"/><path class="crack" d="M12.4 2.6 10.6 7.4 13 10l-2 4 2.4 3.4-1.4 4M10.6 7.4 6 8.6M11 14 6.4 15.4M13 10l4.6 1.6" fill="none"/></svg>`;
export const miniD8 = `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="left" d="M12 1.6 3.4 12 12 15.6Z"/><path class="right" d="M12 1.6 20.6 12 12 15.6Z"/><path class="top" d="M3.4 12 12 22.4 12 15.6Z"/><path class="left" d="M20.6 12 12 22.4 12 15.6Z" opacity=".75"/></svg>`;

/** The great eye that sits behind the duel. */
export const eye = `<svg viewBox="0 0 600 600" aria-hidden="true">
  <g fill="none" stroke="currentColor">
    <circle cx="300" cy="300" r="286" stroke-width="1" opacity=".5"/>
    <circle cx="300" cy="300" r="270" stroke-width=".8" stroke-dasharray="3 9" opacity=".5"/>
    <g opacity=".45" transform="scale(3)">${ring(82, 60, 5, 0.4)}</g>
    <path d="M40 300C110 190 200 140 300 140s190 50 260 160C490 410 400 460 300 460S110 410 40 300Z" stroke-width="1.4"/>
    <circle cx="300" cy="300" r="112" stroke-width="1.2"/><circle cx="300" cy="300" r="74" stroke-width=".8" opacity=".7"/>
    <path d="M300 214c26 46 26 126 0 172-26-46-26-126 0-172Z" stroke-width="1.4"/>
  </g></svg>`;
