// Wikipedia plain-text extracts (prop=extracts, explaintext, exsectionformat=wiki) mark each
// heading as "== Title ==". A field card needs the part that says what the thing looks like,
// so this finds the description section and, inside it, the sentences a walker can use.

export interface Section { level: number; title: string; text: string }

export function sections(extract: string): Section[] {
  const parts = ("\n" + extract).split(/\n(=+)[ \t]*(.+?)[ \t]*\1[ \t]*(?=\n|$)/);
  const out: Section[] = [{ level: 1, title: "", text: (parts[0] ?? "").trim() }];
  for (let i = 1; i < parts.length; i += 3) {
    out.push({ level: (parts[i] ?? "==").length, title: (parts[i + 1] ?? "").trim(), text: (parts[i + 2] ?? "").trim() });
  }
  return out;
}

const DESCRIPTION = /^(description|identification|appearance|morphology|characteristics|field marks|plumage)$/i;

/**
 * The article's description section with its subsections ("=== Leaf ===" under
 * "== Description =="), followed by the lead. Without a description section, the lead.
 */
export function descriptionOf(extract: string): string {
  const all = sections(extract);
  const lead = all[0].text;
  const i = all.findIndex((s) => DESCRIPTION.test(s.title));
  if (i < 0) return lead;
  const parts = [all[i].text];
  for (let j = i + 1; j < all.length && all[j].level > all[i].level; j++) parts.push(all[j].text);
  return [...parts, lead].filter((t) => t.length > 0).join("\n");
}

export type Caution = "touch" | "eat" | "touch-eat" | "bite";

const TOUCH = /\b(urushiol|dermatitis|rash(es)?|blisters?|skin irritation|irritates? the skin|stinging hairs?)\b/i;
const EAT = /\b(poisonous|toxic|toxicity|toxins?|poisoning)\b/i;
const BITE = /\b(venomous|venom)\b/i;
const NOT_HARMFUL = /\b(non-?toxic|not (toxic|poisonous|venomous))\b/i;
const HARM_SECTION = /toxic|poison|venom|hazard|danger|safety|edib/i;

/**
 * What the article warns about for the species itself: a rash from touching, poison if eaten,
 * or a venomous bite or sting. Only the lead, the description and sections about toxicity
 * count; "Similar species", "Uses" and the like talk about other things ("resembles the
 * poisonous earthball", "toxic to native ladybirds"). Callers skip birds.
 */
export function cautionOf(extract: string): Caution | null {
  const all = sections(extract);
  const d = all.findIndex((s) => DESCRIPTION.test(s.title));
  const inDescription = (j: number) => d >= 0 && j >= d && all.slice(d + 1, j + 1).every((s) => s.level > all[d].level);
  const sentences: string[] = [];
  all.forEach((s, j) => {
    const harmSection = HARM_SECTION.test(s.title);
    if (j > 0 && !harmSection && !inDescription(j)) return;
    const text = s.text.slice(0, 2000);
    const said = text.split(/(?<=[.!?])\s+/).filter((x) => !NOT_HARMFUL.test(x));
    // A "Toxicity" heading is itself the warning, unless the section says the opposite.
    if (harmSection && !NOT_HARMFUL.test(text)) said.push(s.title);
    sentences.push(...said);
  });
  const touch = sentences.some((x) => TOUCH.test(x));
  const eat = sentences.some((x) => EAT.test(x));
  if (touch) return eat ? "touch-eat" : "touch";
  if (sentences.some((x) => BITE.test(x))) return "bite";
  return eat ? "eat" : null;
}

const VISUAL = new RegExp(
  "\\b(" +
    [
      "red", "reddish", "orange", "yellow", "yellowish", "green", "greenish", "blue", "bluish", "purple", "purplish", "pink",
      "white", "whitish", "black", "blackish", "brown", "brownish", "gray", "grey", "grayish", "greyish", "golden", "bronze",
      "glossy", "shiny", "pale", "dark", "bright", "spotted", "striped", "streaked", "barred", "mottled", "banded", "patch",
      "patches", "stripe", "stripes", "cap", "crest", "crown", "bill", "beak", "tail", "wings", "wing", "breast", "throat",
      "belly", "head", "neck", "legs", "eyes", "leaves", "leaf", "leaflets", "berries", "berry", "fruit", "flowers", "flower",
      "petals", "bark", "trunk", "stems", "acorns", "seeds", "cones", "needles", "lobed", "toothed", "scent", "fragrant",
      "smell", "call", "calls", "song", "sings", "sounds", "laughing", "trill", "drums", "hops", "flocks", "shelf", "gills",
      "pores", "spores", "clusters", "vine", "shrub", "thickets", "edges", "margin", "underside", "undersides",
    ].join("|") +
    ")\\b",
  "gi",
);

/** Botanical and anatomical terms a walker would not use; a tip copied from them reads badly. */
const JARGON =
  /\b(pistillate|staminate|dioecious|monoecious|inflorescences?|panicles?|umbels?|corymbs?|calyx|drupes?|pomes?|achenes?|bracts?|sepals?|stamens?|petioles?|pubescent|glabrous|lanceolate|ovate|pinnate|palmately|scapulars?|mandibles?|culmen|tarsus|remiges|rectrices|zonate|florets?|hyphae|basidia)\b/gi;

export function splitSentences(text: string): string[] {
  return text.split(/\n+/).flatMap((paragraph) => {
    const sentences = paragraph
      .replace(/\[\d+\]/g, "")
      .replace(/\s*\([^()]*\d[^()]*\)/g, "") // "(39–49 in)": unit conversions and dates in brackets
      .replace(/([a-z]{2}[.!?])([A-Z][a-z])/g, "$1 $2") // "pinkish.Males": paragraphs joined without a space
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);
    // A paragraph cut off mid-sentence ends in a fragment with no full stop.
    if (sentences.length && !/[.!?]["”’)]?$/.test(sentences[sentences.length - 1])) sentences.pop();
    return sentences;
  });
}

function numbers(s: string): number {
  return (s.match(/\d+([.,–-]\d+)?/g) ?? []).length;
}

/**
 * The sentences that say what to look or listen for, in their original order, up to
 * maxChars. Measurement-heavy sentences (weights, wing chords) are what make a 1 B model
 * write numbers it cannot check, so they go first; jargon costs a point too.
 */
export function visualSentences(description: string, maxChars = 600): string[] {
  const all = splitSentences(description);
  const scored = all.map((s, i) => ({
    s,
    i,
    score: (s.match(VISUAL) ?? []).length * 2 - numbers(s) - (s.match(JARGON) ?? []).length,
  }));
  const keep = scored.filter((x) => numbers(x.s) <= 3 && x.score > 0).sort((a, b) => b.score - a.score || a.i - b.i);
  const chosen: typeof keep = [];
  let used = 0;
  for (const x of keep) {
    if (used + x.s.length > maxChars && chosen.length) continue;
    chosen.push(x);
    used += x.s.length + 1;
  }
  // Nothing to look or listen for (a lead that only gives the family): no sentences, and the
  // species makes way for one with a usable description.
  return chosen.sort((a, b) => a.i - b.i).map((x) => x.s);
}

/** "http://en.wikipedia.org/wiki/Wild_turkey" → "Wild turkey" */
export function titleFromUrl(url: string): string {
  const path = url.split("/wiki/")[1] ?? "";
  return decodeURIComponent(path.split("#")[0]).replace(/_/g, " ");
}
