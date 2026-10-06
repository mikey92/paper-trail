// A small model writes the tips, so every tip is checked against the text it was given:
// each content word must come from the species' description (or its names), every number
// must appear there too, and a colour must sit next to the same part in at least one source
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
    "near nearby close look-for out up down"
  ).split(" "),
);

const COLOURS = new Set(
  (
    "red reddish orange orangish yellow yellowish green greenish blue bluish purple purplish pink pinkish white whitish " +
    "black blackish brown brownish gray grey grayish greyish golden gold bronze buff rufous chestnut olive tan cream rusty " +
    "maroon crimson scarlet silver silvery"
  ).split(" "),
);

/** "hopp" (from "hopping") → "hop", "spott" → "spot"; but "fall", "buzz" and "pass" stay. */
function undouble(w: string): string {
  return /([^aeiouylsz])\1$/.test(w) ? w.slice(0, -1) : w;
}

export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && /(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) return undouble(w.slice(0, -3));
  if (w.length > 4 && w.endsWith("ed")) return undouble(w.slice(0, -2));
  if (w.length > 5 && w.endsWith("ly")) return w.slice(0, -2);
  return w;
}

export function words(text: string): string[] {
  return text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z]+/g) ?? [];
}

function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n)));
}

/** "red cap", "white wings" (from "black and white wings"): each colour with the part it describes. */
export function colourPairs(tip: string): [string, string][] {
  const ws = words(tip);
  const pairs: [string, string][] = [];
  ws.forEach((w, i) => {
    if (!COLOURS.has(w)) return;
    const part = ws.slice(i + 1, i + 4).find((x) => !COLOURS.has(x) && !STOP.has(x) && x.length >= 3);
    if (part) pairs.push([w, part]);
  });
  return pairs;
}

export interface Grounding { ok: boolean; unsupported: string[] }

/** Which words, numbers and colour–part pairs of the tip are not backed by the source text. */
export function checkTip(tip: string, source: string): Grounding {
  const known = new Set(words(source).map(stem));
  const nums = new Set(numbersIn(source));
  const unsupported: string[] = [];
  for (const w of words(tip)) {
    if (w.length < 3 || STOP.has(w) || POINTERS.has(w)) continue;
    if (!known.has(stem(w)) && !known.has(w)) unsupported.push(w);
  }
  for (const n of numbersIn(tip)) if (!nums.has(n)) unsupported.push(n);
  if (unsupported.length === 0) {
    const sentences = source.split(/(?<=[.!?])\s+|\n+/).map((s) => new Set(words(s).map(stem)));
    for (const [colour, part] of colourPairs(tip)) {
      const together = sentences.some((s) => s.has(stem(colour)) && s.has(stem(part)));
      if (!together) unsupported.push(`${colour} ${part}`);
    }
  }
  return { ok: unsupported.length === 0, unsupported: [...new Set(unsupported)] };
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
  if (words(t).length > MAX_WORDS) return "";
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
