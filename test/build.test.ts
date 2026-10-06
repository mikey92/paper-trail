import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gather, writeTips } from "../src/build.ts";
import type { Where } from "../src/data.ts";
import type { Generate } from "../src/llm.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/rancho.json", import.meta.url), "utf8")) as {
  species_counts: { taxon: { id: number; wikipedia_url: string } }[];
  descriptions: Record<string, { desc: string }>;
};

// The warnings the real articles carry in their Toxicity sections.
const TOXICITY: Record<string, string> = {
  "51080": "All parts of the plant contain urushiol, which causes an itchy rash.",
  "53405": "The leaves contain cyanogenic glycosides and are toxic.",
  "18209": "Lead poisoning from shot has been reported.", // a bird: must not get a warning
};

/** iNaturalist, Wikipedia and Open-Meteo, answered from the Rancho San Antonio fixture. */
export const fixtureFetch = (async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  const json = (body: unknown) => new Response(JSON.stringify(body));
  if (url.host === "api.inaturalist.org") return json({ results: fixture.species_counts });
  if (url.host === "api.open-meteo.com") {
    return json({
      daily: {
        temperature_2m_max: [73.6],
        temperature_2m_min: [51.2],
        precipitation_probability_max: [10],
        sunrise: ["2026-10-11T07:14"],
        sunset: ["2026-10-11T18:41"],
      },
    });
  }
  if (url.host === "en.wikipedia.org") {
    const title = url.searchParams.get("titles")!;
    const row = fixture.species_counts.find((r) => decodeURIComponent(r.taxon.wikipedia_url.split("/wiki/")[1]).replace(/_/g, " ") === title);
    const id = String(row?.taxon.id);
    const d = fixture.descriptions[id];
    if (!d) return json({ query: { pages: [{ title, missing: true }] } });
    const tox = TOXICITY[id] ? `\n\n== Toxicity ==\n${TOXICITY[id]}` : "";
    return json({ query: { pages: [{ title, extract: `${title} is a species.\n\n== Description ==\n${d.desc}${tox}` }] } });
  }
  return new Response("not found", { status: 404 });
}) as typeof fetch;

const PARK: Where = { label: "Rancho San Antonio County Park and Open Space Preserve, US, CA", lat: 37.33, lng: -122.12, radiusKm: 3 };

describe("gather", () => {
  it("builds an hour's card from the species that have a usable article", async () => {
    const { card, missing } = await gather(PARK, "2026-10-11", 60, "F", fixtureFetch);
    expect(card.entries).toHaveLength(12);
    expect(missing).toBe(4);
    expect(card.entries.map((e) => e.sighting.group)).toEqual([
      "bird", "bird", "bird", "bird",
      "plant", "plant", "plant", "plant", "plant", "plant", "plant",
      "fungus",
    ]);
    expect(card.entries[0].sighting.common).toBe("Wild Turkey");
    expect(card.entries.every((e) => e.sentences.length > 0 && e.by === "pending")).toBe(true);
    expect(card.weather).toMatchObject({ high: 74, sunset: "18:41" });
    expect(card.pool).toBe(30);
  });

  it("warns about poison oak and toyon, and never about a bird", async () => {
    const { card } = await gather(PARK, "2026-10-11", 60, "F", fixtureFetch);
    const caution = Object.fromEntries(card.entries.map((e) => [e.sighting.common, e.caution]));
    expect(caution["Pacific Poison Oak"]).toBe("touch");
    expect(caution["Toyon"]).toBe("eat");
    expect(caution["California Buckeye"]).toBe("eat");
    expect(caution["Acorn Woodpecker"]).toBeNull();
  });
});

describe("writeTips", () => {
  it("fills every entry and reports each one as it lands", async () => {
    const { card } = await gather(PARK, "2026-10-11", 30, "F", fixtureFetch);
    const quoteFirst: Generate = async (messages) => {
      const sentences = messages.at(-1)!.content.split("\n").filter((l) => l.startsWith("- "));
      return sentences[0]?.slice(2) ?? "";
    };
    const landed: number[] = [];
    await writeTips(card, quoteFirst, (i) => landed.push(i));
    expect(landed).toEqual(card.entries.map((_, i) => i));
    expect(card.entries.every((e) => e.by !== "pending" && e.tip.length > 0)).toBe(true);
  });
});
