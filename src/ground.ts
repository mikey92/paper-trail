// A small model writes the tips, so every tip is checked against the text it was given:
// each content word must come from the species' description (or its names), there are no
// numbers, and a colour or pattern must sit next to the same part in at least one source
// sentence. A tip that adds a colour, a body part or a habit the source never mentions, or
// moves the red from the cap to the back, is thrown away, however plausible it sounds.

const STOP = new Set(
  (
    "a an the and or but nor for so yet of in on at to by as is are was were be been being am it its it's this that these those " +
    "with without from into onto over under above below between among along around about across after before during while " +
    "when where which who whom whose what than then there here they them their theirs he she his her him you your we our " +
    "has have had having do does did done can could may might must shall should will would not no yes very more most some " +
    "any each every other another such only just also even both either neither much many few lot lots one ones like " +
    "often usually sometimes typically generally commonly mostly mainly especially quite rather fairly"
  ).split(" "),
);

/** Words a tip may use to point, which say nothing about the species itself. */
const POINTERS = new Set(
  (
    "look looking listen listening watch watching spot spotting find finding notice noticing check search seek scan " +
    "see seen hear heard tell telling recognize recognise identify identified sign signs field tip clue clues key " +
    "observe observing keep eye eyes ear ears out up down"
  ).split(" "),
);

/** Colours, tones and patterns: each must sit next to the same part in the source. */
const MARKS = new Set(
  (
    "red reddish orange orangish yellow yellowish green greenish blue bluish purple purplish pink pinkish white whitish " +
    "black blackish brown brownish gray grey grayish greyish golden gold bronze buff rufous chestnut olive tan cream rusty " +
    "maroon crimson scarlet silver silvery dark pale light bright deep glossy iridescent spotted striped streaked barred " +
    "mottled banded speckled"
  ).split(" "),
);

/** "hopp" (from "hopping") → "hop", "spott" → "spot"; but "fall", "buzz" and "pass" stay. */
function undouble(w: string): string {
  return /([^aeiouylsz])\1$/.test(w) ? w.slice(0, -1) : w;
}

/**
 * A crude stemmer, enough to match a tip's words with the source's: plurals, -ing, -ed, -ly,
 * colour words in -ish ("reddish" backs "red") and a final e ("lobed" and "lobes" meet at "lob").
 */
const IRREGULAR: Record<string, string> = {
  leaves: "leaf", feet: "foot", teeth: "tooth", geese: "goose", mice: "mouse", wolves: "wolf", halves: "half", calves: "calf",
};

export function stem(word: string): string {
  let w = word.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && /(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) w = undouble(w.slice(0, -3));
  else if (w.length > 4 && w.endsWith("ed")) w = undouble(w.slice(0, -2));
  else if (w.length > 5 && w.endsWith("ish")) w = undouble(w.slice(0, -3));
  else if (w.length > 5 && w.endsWith("ly")) w = w.slice(0, -2);
  return w.length > 3 && w.endsWith("e") ? w.slice(0, -1) : w;
}

export function words(text: string): string[] {
  return text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z]+/g) ?? [];
}

function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n)));
}

/** Size, shape and texture words between a colour and its part: "red small round berries". */
const MODIFIERS = new Set(
  (
    "small large big tiny little huge long short thin thick broad narrow wide round rounded oval flat tall low " +
    "smooth rough soft hard scaly fine coarse dense sparse fleshy waxy hairy fuzzy shaggy sticky"
  ).split(" "),
);

/** "red cap", "white wings" (from "black and white wings"): each mark with the part it describes. */
export function colourPairs(tip: string): [string, string][] {
  const ws = words(tip);
  const pairs: [string, string][] = [];
  ws.forEach((w, i) => {
    if (!MARKS.has(w)) return;
    const part = ws.slice(i + 1, i + 5).find((x) => !MARKS.has(x) && !MODIFIERS.has(x) && !STOP.has(x) && x.length >= 3);
    if (part) pairs.push([w, part]);
  });
  return pairs;
}

export interface Grounding { ok: boolean; unsupported: string[] }

/** Numbers spelled out count as numbers ("nine reddish-striped flowers", from "up to nine"). */
const NUMBER_WORDS = new Set(
  "two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty hundred hundreds thousand thousands dozen dozens".split(" "),
);

/** "Listen for" needs something to hear: "listen for pink flowers" is not a tip. */
const SOUND =
  /\b(calls?|calling|songs?|sings?|singing|whistles?|whistling|trills?|sounds?|voice|notes?|chirps?|chatter\w*|drum\w*|buzz\w*|croak\w*|quack\w*|honk\w*|hoot\w*|scream\w*|laugh\w*|cry|cries|rattl\w*|squeal\w*|coo|cooing|gobbl\w*|bugl\w*|howl\w*|hum|humming|click\w*)\b/i;

/** Never on a card, whatever the source says: a walker should not taste anything to identify it. */
const UNSAFE = /\b(tast\w*|edible|eat|eaten|eating|flavou?r\w*|chew\w*|bite into|sweet|sour|bitter)\b/gi;

/** Which words, numbers and colour–part pairs of the tip are not backed by the source text. */
export function checkTip(tip: string, source: string): Grounding {
  const known = new Set(words(source).map(stem));
  const unsupported: string[] = [];
  for (const w of words(tip)) {
    if (w.length < 3 || STOP.has(w) || POINTERS.has(w)) continue;
    if (!known.has(stem(w)) && !known.has(w)) unsupported.push(w);
  }
  // No numbers at all, even ones the source has: "persists for 107.3 days" is true and useless
  // on a walk, and sizes are what a small model garbles.
  for (const n of numbersIn(tip)) unsupported.push(n);
  for (const w of words(tip)) if (NUMBER_WORDS.has(w)) unsupported.push(w);
  for (const m of tip.match(UNSAFE) ?? []) unsupported.push(m.toLowerCase());
  if (/\b(listen|listening|hear|hearing)\b/i.test(tip) && !SOUND.test(tip)) unsupported.push("listen for (nothing to hear)");
  if (unsupported.length === 0) {
    const raw = source.split(/(?<=[.!?])\s+|\n+/).filter((x) => x.trim());
    const sentences = raw.map((x) => words(compoundColours(x)).map(stem));
    for (const [colour, part] of colourPairs(tip)) {
      const c = stem(colour);
      const p = stem(part);
      const together = sentences.some(
        (s, i) =>
          near(s, c, p) ||
          // "The cap is convex. It is smooth and sulphur yellow": the pronoun stands for the cap.
          (i > 0 && /^(it|its|they|their|this|these)\b/i.test(raw[i].trim()) && s.includes(c) && sentences[i - 1].includes(p)),
      );
      if (!together) unsupported.push(`${colour} ${part}`);
    }
  }
  return { ok: unsupported.length === 0, unsupported: [...new Set(unsupported)] };
}

const MARK_STEMS = new Set([...MARKS].map(stem));

/** "glossy bottle-green head" → "glossy green head": the "bottle-" belongs to the colour. */
export function compoundColours(text: string): string {
  return text.replace(/\b([A-Za-z]+)-([A-Za-z]+)\b/g, (m, first: string, second: string) =>
    MARKS.has(second.toLowerCase()) && !MARKS.has(first.toLowerCase()) ? second : m,
  );
}
const LINKS = new Set(["and", "or", "to"]);

/**
 * Does colour `a` describe part `b` in this sentence? They must be within eight words, and no
 * other colour may sit between the colour's own phrase ("reddish brown", "yellow to orangish")
 * and the part. That keeps "white forehead, throat, belly and rump" (white rump) and rejects
 * "gills … darken to a distinctive green colour as the blackish spores develop" (green spores)
 * and "the neck is rusty-gray, with black and white streaking … the head" (rusty head).
 */
function near(s: string[], a: string, b: string, window = 8): boolean {
  const mark = (k: number) => k >= 0 && k < s.length && MARK_STEMS.has(s[k]);
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== a) continue;
    let lo = i;
    let hi = i;
    while (mark(hi + 1) || (LINKS.has(s[hi + 1]) && mark(hi + 2))) hi++;
    while (mark(lo - 1) || (LINKS.has(s[lo - 1]) && mark(lo - 2))) lo--;
    for (let j = 0; j < s.length; j++) {
      if (s[j] !== b || Math.abs(i - j) > window || (j >= lo && j <= hi)) continue;
      const between = j > hi ? s.slice(hi + 1, j) : s.slice(j + 1, lo);
      if (!between.some((w) => MARK_STEMS.has(w))) return true;
    }
  }
  return false;
}

export const MAX_WORDS = 18;

/** One clean line from whatever the model returned, or "" when nothing usable came back. */
export function cleanTip(raw: string, name = ""): string {
  let t = raw.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  t = t.replace(/^(\*\*)?(field )?tip\s*:?\s*(\*\*)?\s*/i, "").replace(/^[-*•\d.)\s]+/, "");
  if (name) {
    const n = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`^(the )?${n}\\s*[:–—-]\\s*`, "i"), "");
  }
  t = t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  // "Look for X. It also Y …": keep the first sentence when the whole answer is too long.
  if (words(t).length > MAX_WORDS) t = t.split(/(?<=[.!?])\s+/)[0];
  if (words(t).length > MAX_WORDS || words(t).length < 4) return "";
  if (!/[.!?]$/.test(t)) t += ".";
  return t[0].toUpperCase() + t.slice(1);
}

/**
 * Used when no model tip survives: the first source sentence short enough for the card,
 * or else the first sentence cut to MAX_WORDS. Quoted, so it is right by construction.
 */
export function fallbackTip(sentences: string[]): string {
  const usable = sentences.filter((s) => s.length > 0);
  const short = usable.find((s) => s.split(/\s+/).length <= MAX_WORDS);
  if (short) return short;
  if (!usable.length) return "";
  return usable[0].split(/\s+/).slice(0, MAX_WORDS).join(" ").replace(/[,;:]$/, "") + " …";
}
