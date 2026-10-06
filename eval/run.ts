// Does the grounding check earn its place, and which Gemma should the page default to?
//
//   node eval/run.ts fetch            gather six places once (iNaturalist, Wikipedia) into eval/cache
//   node eval/run.ts tips <model>     write every tip with gemma-3-1b or gemma-3-270m, on the CPU
//   node eval/run.ts report           eval/EVAL.md from whatever results exist
//   node eval/run.ts sample           public/sample-card.json, the example card on the page
//
// The tips go through the same writeTips() the page uses. Only the runtime differs: here it is
// onnxruntime-node with the q4 weights; the page uses WebGPU with q4f16 where it can.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { gather, writeTips, type Card } from "../src/build.ts";
import type { Where } from "../src/data.ts";
import { MODELS, sourceText, type ChatMessage, type Generate, type ModelKey } from "../src/llm.ts";
import { words } from "../src/ground.ts";

const DATE = "2026-10-11";
const MINUTES = 60;

const PLACES: (Where & { key: string; unit: "F" | "C" })[] = [
  { key: "rancho", unit: "F", label: "Rancho San Antonio County Park and Open Space Preserve, US, CA", lat: 37.33, lng: -122.12, radiusKm: 3 },
  { key: "prospect", unit: "F", label: "Prospect Park, Brooklyn, NY, US", lat: 40.66, lng: -73.97, radiusKm: 1 },
  { key: "hampstead", unit: "C", label: "Hampstead Heath, London, UK", lat: 51.56, lng: -0.16, radiusKm: 2 },
  { key: "stanley", unit: "C", label: "Stanley Park, Vancouver, BC, CA", lat: 49.3, lng: -123.14, radiusKm: 2 },
  { key: "royal", unit: "C", label: "Royal National Park, NSW, AU", lat: -34.11, lng: 151.03, radiusKm: 5 },
  { key: "everglades", unit: "F", label: "Shark Valley, Everglades National Park, FL, US", lat: 25.76, lng: -80.77, radiusKm: 5 },
];

const CACHE = new URL("./cache/", import.meta.url);
const RESULTS = new URL("./results/", import.meta.url);

// Wikimedia asks scripts to say who they are.
const politeFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, { ...init, headers: { ...(init?.headers ?? {}), "User-Agent": "PaperTrail-eval/0.1 (https://github.com/mikey92/paper-trail)" } })) as typeof fetch;

function readJson<T>(url: URL): T {
  return JSON.parse(readFileSync(url, "utf8")) as T;
}

async function fetchPlaces() {
  mkdirSync(CACHE, { recursive: true });
  for (const p of PLACES) {
    const { card, missing } = await gather(p, DATE, MINUTES, p.unit, politeFetch);
    writeFileSync(new URL(`${p.key}.json`, CACHE), JSON.stringify(card, null, 1));
    console.log(`${p.key}: ${card.entries.length} species (pool ${card.pool}, radius ${card.radiusKm} km, ${missing} without a usable article)`);
  }
}

async function runModel(key: ModelKey) {
  const { pipeline } = await import("@huggingface/transformers");
  const started = Date.now();
  const generator = await pipeline("text-generation", MODELS[key].id, { dtype: "q4", device: "cpu" });
  console.log(`${MODELS[key].label} loaded in ${Math.round((Date.now() - started) / 1000)} s`);
  const generate: Generate = async (messages: ChatMessage[], maxNewTokens: number) => {
    const out = await generator(messages, { max_new_tokens: maxNewTokens, do_sample: false });
    const reply = (out[0] as { generated_text: ChatMessage[] }).generated_text.at(-1);
    return typeof reply?.content === "string" ? reply.content : "";
  };
  mkdirSync(RESULTS, { recursive: true });
  const cards: Record<string, Card> = {};
  for (const p of PLACES) {
    const card = readJson<Card>(new URL(`${p.key}.json`, CACHE));
    await writeTips(card, generate, (i, e) => {
      const last = e.result!.attempts.at(-1)!;
      console.log(`${p.key} ${i + 1}/${card.entries.length} [${e.by}] ${e.sighting.common}: ${e.tip}` + (last.unsupported.length ? `  (rejected: ${e.result!.attempts.map((a) => a.unsupported.join("/")).join(" | ")})` : ""));
    });
    card.model = MODELS[key].label;
    cards[p.key] = card;
  }
  await generator.dispose();
  writeFileSync(new URL(`${key}.json`, RESULTS), JSON.stringify(cards, null, 1));
}

/** Longest run of consecutive tip words found in that order in the source, as a share of the tip. */
export function copied(tip: string, source: string): number {
  const t = words(tip);
  const s = words(source).join(" ");
  let best = 0;
  for (let i = 0; i < t.length; i++) {
    for (let j = t.length; j > i + best; j--) {
      if (` ${s} `.includes(` ${t.slice(i, j).join(" ")} `)) {
        best = j - i;
        break;
      }
    }
  }
  return t.length ? best / t.length : 0;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
}

function pct(n: number, d: number): string {
  return d ? `${Math.round((100 * n) / d)}%` : "–";
}

function report() {
  const lines: string[] = ["# Paper Trail evaluation", ""];
  const keys = (Object.keys(MODELS) as ModelKey[]).filter((k) => existsSync(new URL(`${k}.json`, RESULTS)));
  lines.push(
    `Six places, ${DATE} (October), a ${MINUTES}-minute card each: the species, Wikipedia sentences and cautions were fetched once`,
    "(`node eval/run.ts fetch`) so every model sees exactly the same input. Tips were written by `writeTips()` from `src/build.ts`,",
    "the code the page runs, with greedy decoding, on a Mac CPU through onnxruntime-node (q4 weights).",
    "",
    "| Model | Tips | Passed first try | Passed after one retry | Quoted from Wikipedia | Median s per tip (CPU) | Mean words | Mostly copied (≥ 80% one run of source words) |",
    "|---|---|---|---|---|---|---|---|",
  );
  const rejected: Record<string, Map<string, number>> = {};
  const examples: Record<string, string[]> = {};
  for (const key of keys) {
    const cards = readJson<Record<string, Card>>(new URL(`${key}.json`, RESULTS));
    const entries = Object.values(cards).flatMap((c) => c.entries);
    const first = entries.filter((e) => e.by === "gemma").length;
    const retry = entries.filter((e) => e.by === "gemma-retry").length;
    const quoted = entries.filter((e) => e.by === "wikipedia").length;
    const secs = entries.map((e) => (e.result?.attempts ?? []).reduce((t, a) => t + a.ms, 0) / 1000);
    const written = entries.filter((e) => e.by !== "wikipedia");
    const meanWords = written.reduce((t, e) => t + words(e.tip).length, 0) / Math.max(1, written.length);
    const copies = written.filter((e) => copied(e.tip, sourceText(e.sighting, e.sentences)) >= 0.8).length;
    lines.push(
      `| ${MODELS[key].label} | ${entries.length} | ${first} (${pct(first, entries.length)}) | ${first + retry} (${pct(first + retry, entries.length)}) | ${quoted} (${pct(quoted, entries.length)}) | ${median(secs).toFixed(1)} | ${meanWords.toFixed(1)} | ${copies} of ${written.length} |`,
    );
    const counts = new Map<string, number>();
    for (const e of entries) for (const a of e.result?.attempts ?? []) for (const w of a.unsupported) counts.set(w, (counts.get(w) ?? 0) + 1);
    rejected[key] = counts;
    examples[key] = entries
      .filter((e) => (e.result?.attempts[0]?.unsupported.length ?? 0) > 0)
      .slice(0, 8)
      .map((e) => {
        const a = e.result!.attempts;
        return `- **${e.sighting.common}**: “${a[0].tip || a[0].raw.trim()}” → rejected (${a[0].unsupported.join(", ") || "not one short sentence"}); final [${e.by}]: “${e.tip}”`;
      });
  }
  for (const key of keys) {
    const top = [...rejected[key].entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
    lines.push("", `## ${MODELS[key].label}: words the check rejected most`, "", top.map(([w, n]) => `${w} (${n})`).join(", ") || "none");
    lines.push("", `### First tries that failed, and what was printed instead`, "", ...examples[key]);
  }
  writeFileSync(new URL("./EVAL.md", import.meta.url), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
}

function sample() {
  const cards = readJson<Record<string, Card>>(new URL("gemma-3-1b.json", RESULTS));
  const card = cards.rancho;
  for (const e of card.entries) delete e.result;
  // No screen-time claim: this card was written on a CPU by the eval, not in a browser.
  const sampleCard = { card, modelLabel: MODELS["gemma-3-1b"].label, seconds: null };
  writeFileSync(new URL("../public/sample-card.json", import.meta.url), JSON.stringify(sampleCard, null, 1));
  console.log(`wrote public/sample-card.json (${card.entries.length} species)`);
}

const [command, arg] = process.argv.slice(2);
if (command === "fetch") await fetchPlaces();
else if (command === "tips" && arg && arg in MODELS) await runModel(arg as ModelKey);
else if (command === "report") report();
else if (command === "sample") sample();
else {
  console.error("usage: node eval/run.ts fetch | tips <gemma-3-1b|gemma-3-270m> | report | sample");
  process.exit(1);
}
