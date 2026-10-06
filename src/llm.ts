// The part Gemma plays: turn a few Wikipedia sentences into one short line a walker can use.
// This file knows nothing about where the model runs; the browser worker and the Node eval
// both hand it a `generate` function, so the eval measures exactly what the page does.

import { checkTip, cleanTip, fallbackTip } from "./ground.ts";
import { visualScore } from "./wiki.ts";

export interface ChatMessage { role: "user" | "assistant"; content: string }

/** Runs the model on a chat and returns the text of its reply. */
export type Generate = (messages: ChatMessage[], maxNewTokens: number) => Promise<string>;

export const MODELS = {
  "gemma-3-1b": { id: "onnx-community/gemma-3-1b-it-ONNX-GQA", label: "Gemma 3 1B", mb: { q4f16: 763, q4: 859 } },
  "gemma-3-270m": { id: "onnx-community/gemma-3-270m-it-ONNX", label: "Gemma 3 270M", mb: { q4f16: 273, q4: 323 } },
} as const;

export type ModelKey = keyof typeof MODELS;

export interface Species { common: string; scientific: string }

const MAX_NEW_TOKENS = 48;

function request(s: Species, sentences: string[]): string {
  return [
    "Write a field tip for a printed nature-walk card.",
    "",
    `Species: ${s.common} (${s.scientific})`,
    "Source:",
    ...sentences.map((x) => `- ${x}`),
    "",
    'Write ONE sentence of at most 15 words, starting with "Look for" or "Listen for".',
    "Name two or three features, each exactly as the source says it: keep every colour with its own part.",
    "Use only words and facts from the source. No numbers. Do not name the species.",
    "Reply with the sentence only.",
  ].join("\n");
}

// Two worked examples, a bird and a plant, so the model sees the length and the tone without
// latching on to one pattern. Every word of each answer is in its own source.
const EXAMPLES: [Species, string[], string][] = [
  [
    { common: "American Robin", scientific: "Turdus migratorius" },
    ["The American robin has a gray back and an orange-red breast.", "Its song is a cheerful, rising and falling carol, often heard at dawn."],
    "Look for an orange-red breast under a gray back, and listen for a cheerful dawn song.",
  ],
  [
    { common: "Paper Birch", scientific: "Betula papyrifera" },
    ["The bark is bright white and peels in thin papery strips.", "The leaves are oval with a toothed edge and turn yellow in autumn."],
    "Look for bright white bark peeling in papery strips, and oval toothed leaves.",
  ],
];

export function tipMessages(s: Species, sentences: string[]): ChatMessage[] {
  return [
    ...EXAMPLES.flatMap(([species, source, answer]): ChatMessage[] => [
      { role: "user", content: request(species, source) },
      { role: "assistant", content: answer },
    ]),
    { role: "user", content: request(s, sentences) },
  ];
}

function retryRequest(tip: string, unsupported: string[]): string {
  if (!tip) return 'That was not one short sentence. Write ONE sentence of at most 15 words, starting with "Look for" or "Listen for", using only the source.';
  return (
    `The source does not say: ${unsupported.map((w) => `"${w}"`).join(", ")}. ` +
    "Write the tip again using only words and facts from the source. Reply with the sentence only."
  );
}

export interface Attempt { raw: string; tip: string; unsupported: string[]; ms: number }

export interface TipResult {
  tip: string;
  /** "gemma": first try passed; "gemma-retry": passed after being told what was wrong; "wikipedia": quoted. */
  by: "gemma" | "gemma-retry" | "wikipedia";
  attempts: Attempt[];
}

/** The source a tip is checked against: the species' names plus the sentences the model saw. */
export function sourceText(s: Species, sentences: string[]): string {
  return [s.common + ".", s.scientific + ".", ...sentences].join("\n");
}

/**
 * Ask for a tip, check it, and on failure ask once more with the rejected words named.
 * If that fails too, the card quotes Wikipedia instead: a plain tip beats a wrong one.
 */
export async function writeTip(generate: Generate, s: Species, sentences: string[]): Promise<TipResult> {
  const source = sourceText(s, sentences);
  let messages = tipMessages(s, sentences);
  const attempts: Attempt[] = [];
  for (let round = 0; round < 2; round++) {
    const started = Date.now();
    const raw = await generate(messages, MAX_NEW_TOKENS);
    const tip = cleanTip(raw, s.common);
    const check = tip ? checkTip(tip, source) : { ok: false, unsupported: [] };
    attempts.push({ raw, tip, unsupported: check.unsupported, ms: Date.now() - started });
    if (tip && check.ok) return { tip, by: round === 0 ? "gemma" : "gemma-retry", attempts };
    messages = [
      ...messages,
      { role: "assistant", content: raw.trim() || "(no answer)" },
      { role: "user", content: retryRequest(tip, check.unsupported) },
    ];
  }
  return { tip: quoteFor(sentences), by: "wikipedia", attempts };
}

/**
 * The quote a card prints when no tip passes: the most visual sentence that fits on a line.
 * Sentences that only came along as context ("The duckling is able to fly…" before "Its
 * feathers…") are not candidates.
 */
export function quoteFor(sentences: string[]): string {
  const visual = sentences.filter((x) => visualScore(x) > 0);
  const ranked = (visual.length ? visual : sentences)
    .map((x, i) => ({ x, i }))
    .sort((a, b) => visualScore(b.x) - visualScore(a.x) || a.i - b.i);
  // A short sentence must name at least two things to see or hear; otherwise the best one is
  // cut ("…") rather than quoting "The plant can spread … by its seeds or by rhizomes".
  return fallbackTip(ranked.filter((r, k) => k === 0 || visualScore(r.x) >= 4).map((r) => r.x));
}
