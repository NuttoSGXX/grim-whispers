// Grim Sanity: the Darkness deck, the Light boons, presets and flavour lines.
// Card text is kept in Thai and English; a world setting picks which one is shown.

export const SUITS = {
  frenzy: { th: "คลุ้มคลั่ง", en: "Frenzy" },
  spores: { th: "สปอร์", en: "Spores" },
  ooze: { th: "เมือก", en: "Ooze" },
  doubt: { th: "ระแวง", en: "Doubt" },
  vigil: { th: "ยามวิกาล", en: "Vigil" }
};

const A = (key, value) => ({ key, value: String(value) });
const dis = (skill) => A(`system.skills.${skill}.roll.mode`, -1);
const disAbility = (ability, kind) => A(`system.abilities.${ability}.${kind}.roll.mode`, -1);

/** who: "party" = everyone, "area" = only characters inside the affected area. */
export const DARK = [
  {
    id: "two-voices", suit: "frenzy", trauma: 1, who: "party",
    th: { name: "เสียงซ้อน", board: "NPC ทุกตัวในซีนพูดเป็นสองเสียงซ้อนกันชั่วครู่ แสงทุกดวงหรี่เป็น dim light 1 รอบ", symptom: "ได้ยินเสียงที่สองแทรกทุกบทสนทนา: disadvantage กับ Perception ที่ใช้การฟัง" },
    en: { name: "The Second Voice", board: "Every NPC in the scene speaks in two overlapping voices for a moment. All light drops to dim for 1 round.", symptom: "A second voice cuts into every conversation: disadvantage on Perception checks that rely on hearing." }
  },
  {
    id: "deep-drums", suit: "frenzy", trauma: 2, who: "party",
    th: { name: "กลองใต้พิภพ", board: "เสียงกลองดังก้องทั้งถ้ำ ใครคง concentration อยู่ต้องเซฟ DC 10 และทอย random encounter ทันที", symptom: "จังหวะกลองไม่ออกจากหัว: long rest ถัดไปไม่ได้ Hit Dice คืน" },
    en: { name: "Drums from the Deep", board: "Drums echo through the cavern. Anyone concentrating makes a DC 10 save, and a random encounter is rolled at once.", symptom: "The rhythm will not leave your head: your next long rest restores no Hit Dice." }
  },
  {
    id: "frenzied-herd", suit: "frenzy", trauma: 2, who: "party", changes: [dis("ste")],
    th: { name: "ฝูงแตกตื่น", board: "สัตว์ Underdark ใกล้เคียงแตกตื่น เพิ่มศัตรู CR ต่ำ 1d4 ตัวเข้าซีน หรือศัตรูที่มีอยู่ได้ +2 damage 3 รอบ", symptom: "กระสับกระส่าย หายใจแรง: disadvantage กับ Stealth" },
    en: { name: "The Frenzied Herd", board: "Nearby Underdark beasts stampede. Add 1d4 low-CR enemies, or the enemies present deal +2 damage for 3 rounds.", symptom: "Restless, breathing hard: disadvantage on Stealth." }
  },
  {
    id: "two-headed-shadow", suit: "frenzy", trauma: 3, who: "party", changes: [dis("ins")],
    th: { name: "เงาแฝด", board: "เงามหึมาสองหัวพาดผ่านผนังถ้ำ NPC ร่วมทางทุกตัวเซฟ WIS DC 12 ไม่ผ่านชะงักหรือหนี 1 รอบ", symptom: "ระแวงทุกอย่างที่มาเป็นคู่: disadvantage กับ Insight" },
    en: { name: "The Twin Shadow", board: "A vast two-headed shadow sweeps across the cavern wall. Every companion NPC makes a DC 12 Wisdom save or freezes or flees for 1 round.", symptom: "You distrust anything that comes in pairs: disadvantage on Insight." }
  },
  {
    id: "bloom", suit: "spores", trauma: 1, who: "area",
    th: { name: "ดงเห็ดเรือง", board: "เห็ดเรืองแสงงอกขึ้น 3 จุด จุดละ 10 ฟุต เป็น difficult terrain และซ่อนตัวในนั้นไม่ได้", symptom: "รู้สึกว่าเห็ดหันตามตัวเอง: disadvantage กับเซฟต้านพิษและสปอร์" },
    en: { name: "The Glowing Grove", board: "Glowing fungus erupts in three 10-foot patches. They are difficult terrain and nothing can hide inside them.", symptom: "The mushrooms seem to turn and follow you: disadvantage on saves against poison and spores." }
  },
  {
    id: "roots-beneath", suit: "spores", trauma: 2, who: "party", changes: [A("system.attributes.concentration.roll.mode", -1)],
    th: { name: "รากชอนไช", board: "เสบียงขึ้นรา ปาร์ตี้เสียอาหาร 1d4 วัน", symptom: "เหมือนมีอะไรไชอยู่ใต้ผิวหนัง: disadvantage กับเซฟ concentration" },
    en: { name: "Roots Beneath the Skin", board: "The rations turn to mould. The party loses 1d4 days of food.", symptom: "Something seems to burrow under your skin: disadvantage on concentration saves." }
  },
  {
    id: "drowsing-spores", suit: "spores", trauma: 2, who: "area", changes: [dis("inv")],
    th: { name: "หมอกสปอร์", board: "เมฆสปอร์รัศมี 20 ฟุต อยู่ 1 นาที ข้างในเป็น heavily obscured เข้าไปต้องเซฟ CON DC 12 ไม่ผ่าน poisoned 1 รอบ", symptom: "เห็นใบหน้าคนรู้จักในดงเห็ด: disadvantage กับ Investigation" },
    en: { name: "Spore Fog", board: "A 20-foot-radius spore cloud lingers for 1 minute. It is heavily obscured; entering it calls for a DC 12 Constitution save or be poisoned for 1 round.", symptom: "You see familiar faces among the fungus: disadvantage on Investigation." }
  },
  {
    id: "brides-song", suit: "spores", trauma: 3, who: "party", changes: [dis("ste")],
    th: { name: "เพลงวิวาห์", board: "สิ่งมีชีวิตเชื้อราทุกตัวในซีนฮัมเพลงเดียวกัน อีก 3 รอบ spore servant 1d4 ตัวเดินเข้ามา", symptom: "เผลอฮัมทำนองที่ไม่เคยได้ยิน: disadvantage กับ Stealth" },
    en: { name: "The Wedding Song", board: "Every fungal creature in the scene hums the same tune. In 3 rounds, 1d4 spore servants walk in.", symptom: "You catch yourself humming a tune you have never heard: disadvantage on Stealth." }
  },
  {
    id: "dripping-ceiling", suit: "ooze", trauma: 1, who: "area", changes: [A("system.attributes.init.roll.mode", -1)],
    th: { name: "ฝนกรด", board: "กรดหยดลง 3 ช่องสุ่ม ใครเริ่มเทิร์นในช่องนั้นโดน 1d4 acid อยู่ 3 รอบ", symptom: "สะดุ้งทุกครั้งที่มีอะไรหยดใส่: disadvantage กับ Initiative ครั้งถัดไป" },
    en: { name: "Acid Rain", board: "Acid drips onto 3 random squares for 3 rounds. A creature starting its turn there takes 1d4 acid damage.", symptom: "You flinch whenever something drips on you: disadvantage on your next Initiative roll." }
  },
  {
    id: "liquid-floor", suit: "ooze", trauma: 2, who: "area", changes: [A("system.attributes.movement.walk", -5)],
    th: { name: "ธรณีเมือก", board: "พื้นรัศมี 20 ฟุตกลายเป็นเมือก เป็น difficult terrain เข้าไปต้องเซฟ DEX DC 12 ไม่ผ่านล้ม prone", symptom: "รู้สึกว่าร่างกายตัวเองหนืด: speed ลด 5 ฟุต" },
    en: { name: "The Slime Ground", board: "The floor in a 20-foot radius turns to slime. It is difficult terrain; entering it calls for a DC 12 Dexterity save or fall prone.", symptom: "Your own body feels thick and slow: speed reduced by 5 feet." }
  },
  {
    id: "lightswallow", suit: "ooze", trauma: 2, who: "party",
    th: { name: "แสงดับ", board: "เมือกคลุมแหล่งแสงที่ไม่ใช่เวทมนตร์ทั้งหมด มืดสนิท 1 รอบ ต้องใช้ action จุดใหม่", symptom: "ไม่ไว้ใจแสงไฟ: disadvantage กับ Perception ที่ใช้สายตาเมื่ออยู่ใน bright light" },
    en: { name: "Lights Out", board: "Slime smothers every non-magical light source. Total darkness for 1 round; relighting takes an action.", symptom: "You no longer trust the light: disadvantage on sight-based Perception while in bright light." }
  },
  {
    id: "faceless-thing", suit: "ooze", trauma: 3, who: "party", changes: [dis("ath")],
    th: { name: "ผู้ไร้หน้า", board: "ooze หนึ่งตัวไหลออกจากรอยแยกใกล้ปาร์ตี้ (gray ooze หรือ ochre jelly ตามเลเวล)", symptom: "ขยะแขยงทุกอย่างที่เปียกลื่น: disadvantage กับ Athletics" },
    en: { name: "The Faceless Thing", board: "An ooze pours out of a crack near the party (a gray ooze or an ochre jelly, by level).", symptom: "Anything wet and slick revolts you: disadvantage on Athletics." }
  },
  // ----- Doubt: cards that land in the middle of a conversation -----
  {
    id: "familiar-face", suit: "doubt", trauma: 1, who: "party", changes: [dis("ins")],
    th: { name: "หน้าคนคุ้น", board: "ชั่วพริบตา NPC ที่กำลังคุยด้วยมีใบหน้าของคนที่จากไปแล้ว การทอย Charisma ครั้งถัดไปกับ NPC คนนั้นมี disadvantage", symptom: "เห็นใบหน้าเดิมซ้อนอยู่บนคนแปลกหน้า: disadvantage กับ Insight" },
    en: { name: "A Familiar Face", board: "For a blink, the NPC you are speaking with wears the face of someone long gone. The next Charisma check made with that NPC has disadvantage.", symptom: "The same face lies over every stranger: disadvantage on Insight." }
  },
  {
    id: "unsaid-words", suit: "doubt", trauma: 1, who: "party",
    th: { name: "คำที่ไม่ได้เอ่ย", board: "ทุกคนได้ยิน NPC พูดประโยคหนึ่งชัดเจน แต่ NPC ไม่ได้พูด DM บอกประโยคนั้น: คำขู่ คำสารภาพ หรือชื่อของใครบางคน", symptom: "ไม่แน่ใจว่าสิ่งที่ได้ยินเป็นจริง: disadvantage กับ Perception ที่ใช้การฟัง" },
    en: { name: "Words Unsaid", board: "Everyone clearly hears an NPC say one sentence the NPC never spoke. The GM chooses it: a threat, a confession, or a name.", symptom: "You no longer trust what you hear: disadvantage on Perception checks that rely on hearing." }
  },
  {
    id: "eyes-in-crowd", suit: "doubt", trauma: 2, who: "party", changes: [dis("per")],
    th: { name: "ร้อยสายตา", board: "ทุกคนรอบตัวหยุดและหันมามองปาร์ตี้พร้อมกันหนึ่งลมหายใจ แล้วทำต่อเหมือนไม่มีอะไรเกิดขึ้น ท่าทีของ NPC ในซีนนี้แย่ลงหนึ่งขั้น", symptom: "รู้สึกถูกจ้องอยู่ตลอด: disadvantage กับ Persuasion" },
    en: { name: "A Hundred Eyes", board: "Everyone nearby stops and turns to stare at the party for one breath, then carries on as if nothing happened. NPC attitudes in this scene worsen by one step.", symptom: "You feel watched at every moment: disadvantage on Persuasion." }
  },
  {
    id: "borrowed-voice", suit: "doubt", trauma: 2, who: "party", changes: [dis("dec")],
    th: { name: "เสียงที่ถูกยืม", board: "NPC คนหนึ่งเอ่ยประโยคที่ตัวละครในปาร์ตี้เพิ่งพูดไปใน session นี้ ด้วยเสียงของตัวละครคนนั้น NPC รอบข้างหวาดกลัวและถอยห่าง", symptom: "ไม่ไว้ใจเสียงของตัวเอง: disadvantage กับ Deception" },
    en: { name: "The Borrowed Voice", board: "An NPC repeats a line one of the party said earlier this session, in that character's own voice. The NPCs nearby grow afraid and draw back.", symptom: "You do not trust your own voice: disadvantage on Deception." }
  },
  {
    id: "name-called", suit: "doubt", trauma: 3, who: "party", changes: [disAbility("wis", "save")],
    th: { name: "นามที่ถูกขาน", board: "คนแปลกหน้าเดินสวนและกระซิบชื่อจริงของทุกคนในปาร์ตี้ แล้วหายไปในฝูงชน มีใครบางคนที่นี่รู้ว่าพวกคุณเป็นใคร (DM เพิ่มผู้สะกดรอยหนึ่งคน)", symptom: "สะดุ้งทุกครั้งที่ได้ยินชื่อตัวเอง: disadvantage กับ Wisdom saving throw" },
    en: { name: "The Name Called", board: "A stranger brushes past, whispers every party member's true name, and is gone into the crowd. Someone here knows who you are (the GM adds one pursuer).", symptom: "You flinch whenever you hear your name: disadvantage on Wisdom saving throws." }
  },
  // ----- Vigil: cards for camp and long rests -----
  {
    id: "dying-fire", suit: "vigil", trauma: 1, who: "party", changes: [disAbility("con", "check")],
    th: { name: "ไฟมอด", board: "กองไฟและแสงทุกดวงในค่ายหรี่ลงเหลือ dim light และจุดไม่ติดอีกหนึ่งชั่วโมง ความหนาวคืบเข้ามา", symptom: "หนาวเข้ากระดูก: disadvantage กับ Constitution check" },
    en: { name: "The Dying Fire", board: "The campfire and every light in camp sink to dim light and will not catch again for an hour. The cold creeps in.", symptom: "Chilled to the bone: disadvantage on Constitution checks." }
  },
  {
    id: "one-too-many", suit: "vigil", trauma: 1, who: "party", changes: [dis("prc")],
    th: { name: "เกินมาหนึ่ง", board: "ใครนับคนรอบกองไฟก็ได้มากกว่าจำนวนจริงหนึ่งคนเสมอ จนกว่าจะเช้า", symptom: "นับคนซ้ำไม่หยุด: disadvantage กับ Perception" },
    en: { name: "One Too Many", board: "Whoever counts the people around the fire always counts one more than there are, until morning.", symptom: "You keep counting heads: disadvantage on Perception." }
  },
  {
    id: "voice-in-dark", suit: "vigil", trauma: 2, who: "party",
    th: { name: "เสียงเพรียก", board: "เสียงที่คุ้นเคยเรียกชื่อตัวละครหนึ่งคนจากนอกแสงไฟ (สุ่มตัวละคร) NPC ร่วมทางหนึ่งคนลุกเดินตามเสียงไป ถ้าไม่มีใครห้าม", symptom: "หูแว่วเสียงเรียกทั้งคืน: long rest นี้ไม่ได้ Hit Dice คืน" },
    en: { name: "The Calling Voice", board: "A familiar voice calls one character's name from beyond the firelight (choose at random). One companion NPC rises and walks toward it unless someone stops them.", symptom: "The call rings in your ears all night: this long rest restores no Hit Dice." }
  },
  {
    id: "shared-dream", suit: "vigil", trauma: 2, who: "party", changes: [A("system.attributes.init.roll.mode", -1)],
    th: { name: "ฝันร่วม", board: "ทุกคนที่หลับฝันเรื่องเดียวกัน DM บรรยายหนึ่งภาพจากสิ่งที่รออยู่ข้างหน้า คนที่ตื่นอยู่เห็นเพื่อนขยับปากพูดพร้อมกันทั้งที่หลับ", symptom: "ฝันยังค้างอยู่ในตา: disadvantage กับ Initiative" },
    en: { name: "The Shared Dream", board: "Everyone asleep dreams the same dream. The GM describes one image of what lies ahead. Those awake see the sleepers mouth the same words together.", symptom: "The dream still hangs before your eyes: disadvantage on Initiative." }
  },
  {
    id: "watcher-at-edge", suit: "vigil", trauma: 3, who: "party", changes: [dis("sur")],
    th: { name: "ผู้เฝ้าขอบแสง", board: "ร่างสูงยืนนิ่งอยู่ตรงขอบแสงไฟตลอดคืน ไม่เข้ามา ไม่จากไป ใครเข้าเวรยามต้องเซฟ WIS DC 13 ไม่ผ่านได้ exhaustion 1 ระดับ ตอนเช้ามีรอยเท้าวนรอบค่าย", symptom: "มัวแต่เหลียวมองข้างหลัง: disadvantage กับ Survival" },
    en: { name: "The Watcher at the Edge", board: "A tall figure stands at the edge of the firelight all night. It does not come closer and does not leave. Anyone who keeps watch makes a DC 13 Wisdom save or gains 1 level of exhaustion. At dawn, footprints circle the camp.", symptom: "You keep looking over your shoulder: disadvantage on Survival." }
  }
];

/** auto: what the module can do by itself when the boon is granted. */
export const LIGHT = [
  { id: "warning-call", th: { name: "ลางเตือน", effect: "ปาร์ตี้ไม่ถูก surprise ใน encounter ถัดไป", told: "เสียงหินร่วงดังขึ้นก่อนเวลาอันควร" }, en: { name: "Warning Call", effect: "The party cannot be surprised in the next encounter.", told: "A stone falls a moment too early." } },
  { id: "clear-water", th: { name: "ตาน้ำ", effect: "เจอแหล่งน้ำและอาหารพอสำหรับ 1 วัน", told: "ตาน้ำเล็ก ๆ ที่มีเห็ดกินได้ขึ้นรอบ" }, en: { name: "Clear Water", effect: "The party finds water and food for 1 day.", told: "A small spring, ringed with edible fungus." } },
  { id: "faint-glimmer", auto: "restore", th: { name: "แสงรำไร", effect: "ตัวละครที่เต๋าร้าวมากที่สุดได้เต๋าคืน 1 ลูก", told: "แสงอุ่นวูบหนึ่งที่ไม่มีที่มา" }, en: { name: "Faint Glimmer", effect: "The character with the most cracked dice mends 1 die.", told: "A warm flicker of light with no source." } },
  { id: "lifting-fog", auto: "cleanse", th: { name: "หมอกจาง", effect: "ตัวละครหนึ่งตัวหายจากอาการที่ติดอยู่", told: "เสียงในหัวเงียบลงเป็นครั้งแรก" }, en: { name: "Lifting Fog", effect: "One character is freed from their symptom.", told: "For the first time, the voice in your head goes quiet." } },
  { id: "second-breath", th: { name: "ลมปราณ", effect: "ตัวละครทุกตัวฟื้น HP เท่ากับ Hit Die 1 ลูก โดยไม่เสีย Hit Die", told: "ลมเย็นพัดมาจากทางที่ไม่ควรมีลม" }, en: { name: "Second Breath", effect: "Every character regains HP equal to one Hit Die, without spending it.", told: "A cool wind blows from where no wind should be." } },
  { id: "glowing-tracks", th: { name: "รอยเรือง", effect: "advantage กับการทอยนำทางครั้งถัดไป", told: "ไลเคนเรืองแสงเรียงเป็นแนว" }, en: { name: "Glowing Tracks", effect: "Advantage on the next navigation roll.", told: "Glowing lichen grows in a line." } },
  { id: "shortcut", th: { name: "ทางลัด", effect: "ย่นการเดินทางครึ่งวัน", told: "ช่องแคบที่ไม่อยู่ในแผนที่ของใคร" }, en: { name: "The Shortcut", effect: "Half a day is cut from the journey.", told: "A narrow passage on no one's map." } },
  { id: "heart-ward", auto: "ward", th: { name: "เกราะใจ", effect: "การดวลเต๋าครั้งถัดไป เสมอผู้เล่นชนะ", told: "ความทรงจำดี ๆ ผุดขึ้นมาพร้อมกันทั้งกลุ่ม" }, en: { name: "Heart Ward", effect: "In the next duel, ties go to the players.", told: "A good memory rises in all of you at once." } }
];

const of = (...suits) => DARK.filter((c) => suits.includes(c.suit)).map((c) => c.id);

/** One-click deck presets. `only` lists the cards left open (null = every card); `cap` is the highest Trauma allowed. */
export const PRESETS = {
  travel: { label: "Travel", cap: 3, only: of("frenzy", "spores", "ooze") },
  combat: { label: "Combat", cap: 2, only: ["two-voices", "bloom", "drowsing-spores", "dripping-ceiling", "liquid-floor", "lightswallow"] },
  social: { label: "Social", cap: 3, only: [...of("doubt"), "two-voices"] },
  camp: { label: "Camp", cap: 3, only: [...of("vigil"), "two-voices", "roots-beneath", "lightswallow"] },
  all: { label: "All", cap: 3, only: null },
  sealed: { label: "Sealed", cap: 3, only: [] }
};

export const TIER = (trauma) => (trauma >= 3 ? "inconceivable" : trauma === 2 ? "scarring" : "jarring");
export const TIER_LABEL = { jarring: "Jarring", scarring: "Scarring", inconceivable: "Inconceivable" };

const LINES = {
  jarring: [
    "Something shifts at the edge of the light.", "It is only the dark. It is only the dark.", "Did the stone just breathe?",
    "A sound that should not have an echo.", "Keep walking. Do not look twice.", "The silence leans a little closer."
  ],
  scarring: [
    "The dark has learned your name.", "You will carry this one out with you.", "Something down here is paying attention.",
    "The walls remember what they have seen.", "Do not listen to what answers.", "It knows which of you is afraid."
  ],
  inconceivable: [
    "There are no words for it. There never were.", "The abyss opens one more eye.", "What you see cannot be unseen.",
    "Hold on to your name. It is all you have.", "The deep turns its whole weight toward you.", "Pray that it only looks."
  ]
};

export const pickLine = (trauma) => { const l = LINES[TIER(trauma)]; return l[Math.floor(Math.random() * l.length)]; };

export const STAMPS = {
  unshaken: "Unshaken", shaken: "Shaken", fractured: "Fractured", broken: "Broken", unhinged: "Unhinged", haunted: "Haunted"
};
export const UNTIL = { scene: "until the scene ends", rest: "until the next long rest", full: "until every die has mended" };
export const UNTIL_SHORT = { scene: "Scene", rest: "Long rest", full: "All dice" };

export const cardById = (id) => DARK.find((c) => c.id === id) ?? null;
export const boonById = (id) => LIGHT.find((c) => c.id === id) ?? null;

/** Cards the GM has left open. deck = { off: {id:true}, suits: {suit:false}, cap } */
export function openCards(deck = {}) {
  const cap = Number(deck.cap) || 3;
  return DARK.filter((c) => !deck.off?.[c.id] && deck.suits?.[c.suit] !== false && c.trauma <= cap);
}

export function drawCards(deck, count = 3) {
  const pool = [...openCards(deck)];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, count);
}

export function presetDeck(key) {
  const p = PRESETS[key]; if (!p) return null;
  const off = {};
  if (p.only) for (const c of DARK) if (!p.only.includes(c.id)) off[c.id] = true;
  return { off, suits: {}, cap: p.cap, preset: key };
}
