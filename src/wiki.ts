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

/** Subsections that describe other species: "Similar species", "Lookalikes", "Confusion with…". */
const OTHER_SPECIES = /similar|look-?alike|confus|distinguish|related species|hybrid/i;

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
  for (let j = i + 1; j < all.length && all[j].level > all[i].level; j++) {
    if (!OTHER_SPECIES.test(all[j].title)) parts.push(all[j].text);
  }
  return [...parts, lead].filter((t) => t.length > 0).join("\n");
}

export type Caution = "touch" | "eat" | "touch-eat" | "bite";

const TOUCH = /\b(urushiol|dermatitis|rash(es)?|blisters?|skin irritation|irritates? the skin|stinging hairs?)\b/i;
const EAT = /\b(poisonous|toxic|toxicity|toxins?|poisoning)\b/i;
const BITE = /\b(venomous|venom)\b/i;
const NOT_HARMFUL = /\b(non-?toxic|not (toxic|poisonous|venomous))\b/i;
/** Harm done to the species rather than by it: "used in studies of pesticide toxicity". */
const AGENT = /\b(pesticides?|insecticides?|herbicides?|fungicides?|miticides?|lead shot|heavy metals?|pollutants?|pollution)\b/i;
// "Toxicity", "Toxicity and uses", "Poisoning"; not "Pesticide toxicity" (harm done *to* the
// species) or "Edibility" (mostly about poisonous look-alikes).
const HARM_SECTION = /^(toxic|poison|venom|hazard|danger|safety)/i;

/**
 * What the article warns about for the species itself: a rash from touching, poison if eaten,
 * or a venomous bite or sting. Only the lead, the description and sections about toxicity
 * count, minus subsections about look-alikes; "Uses", "Ecology" and the like talk about
 * other things ("resembles the poisonous earthball", "toxic to native ladybirds"). Callers
 * skip birds.
 */
export function cautionOf(extract: string): Caution | null {
  const all = sections(extract);
  const d = all.findIndex((s) => DESCRIPTION.test(s.title));
  const inDescription = (j: number) => d >= 0 && j >= d && all.slice(d + 1, j + 1).every((s) => s.level > all[d].level);
  const sentences: string[] = [];
  all.forEach((s, j) => {
    const harmSection = HARM_SECTION.test(s.title);
    if (j > 0 && !harmSection && !inDescription(j)) return;
    if (OTHER_SPECIES.test(s.title)) return;
    const text = s.text.slice(0, 2000);
    const said = text.split(/(?<=[.!?])\s+/).filter((x) => !NOT_HARMFUL.test(x) && !AGENT.test(x));
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
 * Not about what this species looks like: years and conservation status ("the IUCN Red List"
 * is not red), comparisons, which describe the other species ("unlike the snowy egret"), and
 * taste, which no card should send anyone to check.
 */
const NOT_VISUAL =
  /\b(1[5-9]\d\d|20\d\d)\b|\bIUCN\b|red list|conservation status|least concern|endangered|\bunlike\b|similar to|resembl|confused with|\bthan (the|a|an|other|that|those)\b|\b(taste[sd]?|tasting|edible|flavou?r)\b/i;

/** How much a sentence says about what to look or listen for. */
export function visualScore(s: string): number {
  if (NOT_VISUAL.test(s) || numbers(s) > 3) return 0;
  return (s.match(VISUAL) ?? []).length * 2 - numbers(s) - (s.match(JARGON) ?? []).length;
}

/**
 * The sentences that say what to look or listen for, in their original order, up to
 * maxChars. Measurement-heavy sentences (weights, wing chords) are what make a 1 B model
 * write numbers it cannot check, so they go first; jargon costs a point too.
 */
/**
 * "The snowy egret is readily distinguished from the great egret …" is about the snowy egret,
 * though it sits in the great egret's article: the species itself comes after from/than.
 */
export function aboutAnother(sentence: string, name: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b(from|than|unlike)\\s+((that|those) of\\s+)?(the\\s+)?${n}`, "i").test(sentence);
}

export function visualSentences(description: string, maxChars = 600, name = ""): string[] {
  const all = splitSentences(description);
  const scored = all.map((s, i) => ({ s, i, score: aboutAnother(s, name) ? 0 : visualScore(s) }));
  const keep = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.i - b.i);
  const chosen: typeof keep = [];
  let used = 0;
  for (const x of keep) {
    if (used + x.s.length > maxChars && chosen.length) continue;
    chosen.push(x);
    used += x.s.length + 1;
  }
  // "It is smooth and sulphur yellow" means nothing without the sentence before it ("The cap
  // is convex…"), so that one comes along, even past the budget.
  for (const x of [...chosen]) {
    const before = scored[x.i - 1];
    if (PRONOUN_START.test(x.s) && before && !chosen.includes(before)) chosen.push(before);
  }
  // Nothing to look or listen for (a lead that only gives the family): no sentences, and the
  // species makes way for one with a usable description.
  return chosen.sort((a, b) => a.i - b.i).map((x) => x.s);
}

export const PRONOUN_START = /^(it|its|they|their|this|these)\b/i;

/** "http://en.wikipedia.org/wiki/Wild_turkey" → "Wild turkey" */
export function titleFromUrl(url: string): string {
  const path = url.split("/wiki/")[1] ?? "";
  return decodeURIComponent(path.split("#")[0]).replace(/_/g, " ");
}
