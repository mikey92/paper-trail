// From a place and a date to a finished card. The page and the Node eval both run this, with
// their own fetch and their own way of running Gemma, so what the eval measures is the app.

import { forecast, mapLimit, sightingsNear, wikiExtract, type Weather, type Where } from "./data.ts";
import type { Generate, TipResult } from "./llm.ts";
import { writeTip } from "./llm.ts";
import { pick, speciesFor, type Sighting } from "./select.ts";
import { cautionOf, descriptionOf, titleFromUrl, visualSentences, type Caution } from "./wiki.ts";
import { fallbackTip } from "./ground.ts";

export interface Entry {
  sighting: Sighting;
  /** The Wikipedia sentences the tip was written from (and checked against). */
  sentences: string[];
  caution: Caution | null;
  tip: string;
  by: TipResult["by"] | "pending";
  result?: TipResult;
}

export interface Card {
  where: Where;
  date: string;
  minutes: number;
  radiusKm: number;
  /** Species with a Wikipedia article reported in the radius this month, before picking. */
  pool: number;
  weather: Weather | null;
  entries: Entry[];
  model: string | null;
}

export interface Gathered { card: Card; missing: number }

/** Everything except the tips: species, their sentences and cautions, and the weather. */
export async function gather(where: Where, date: string, minutes: number, unit: "F" | "C", fetcher: typeof fetch = fetch): Promise<Gathered> {
  const month = Number(date.slice(5, 7));
  const want = speciesFor(minutes);
  const [{ sightings, radiusKm }, weather] = await Promise.all([
    sightingsNear(where, month, want, fetcher),
    forecast(where, date, unit, fetcher).catch(() => null),
  ]);
  // Ask for a few spares: some articles have no usable description.
  const candidates = pick(sightings, want + 4);
  const read = await mapLimit(candidates, 4, async (s) => {
    const extract = s.wikipediaUrl ? await wikiExtract(titleFromUrl(s.wikipediaUrl), fetcher).catch(() => "") : "";
    const sentences = extract ? visualSentences(descriptionOf(extract)) : [];
    const caution = s.group === "bird" ? null : cautionOf(extract);
    return { sighting: s, sentences, caution };
  });
  const usable = read.filter((r) => r.sentences.length > 0);
  const keep = new Set(pick(usable.map((r) => r.sighting), want));
  const entries: Entry[] = usable
    .filter((r) => keep.has(r.sighting))
    .map((r) => ({ ...r, tip: fallbackTip(r.sentences), by: "pending" as const }));
  const card: Card = {
    where,
    date,
    minutes,
    radiusKm,
    pool: sightings.filter((s) => s.wikipediaUrl).length,
    weather,
    entries: sortEntries(entries),
    model: null,
  };
  return { card, missing: candidates.length - usable.length };
}

function sortEntries(entries: Entry[]): Entry[] {
  const order = ["bird", "plant", "fungus", "insect", "other"];
  return entries.sort((a, b) => order.indexOf(a.sighting.group) - order.indexOf(b.sighting.group) || b.sighting.count - a.sighting.count);
}

/** Write every tip in turn, reporting each as it lands so the page can fill the card in. */
export async function writeTips(card: Card, generate: Generate, onTip?: (i: number, entry: Entry) => void): Promise<void> {
  for (const [i, entry] of card.entries.entries()) {
    const result = await writeTip(generate, entry.sighting, entry.sentences);
    entry.tip = result.tip;
    entry.by = result.by;
    entry.result = result;
    onTip?.(i, entry);
  }
}
