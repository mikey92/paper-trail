import { describe, expect, it } from "vitest";
import { forecast, here, mapLimit, radiusFor, rankPlaces, round2, sightingsNear, speciesCounts, wikiExtract, type Where } from "../src/data.ts";

/** A fetch that answers from a function of the URL and remembers what was asked. */
function fakeFetch(answer: (url: URL) => unknown, status = 200) {
  const asked: URL[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    asked.push(url);
    return new Response(JSON.stringify(answer(url)), { status });
  }) as typeof fetch;
  return { fetcher, asked };
}

const PARK: Where = { label: "Rancho San Antonio County Park and Open Space Preserve, US, CA", lat: 37.33, lng: -122.12, radiusKm: 3 };

describe("places", () => {
  // Rows as iNaturalist's autocomplete returned them for "Prospect Park" (October 2026).
  const rows = [
    { display_name: "Prospect Hill Park, CA, US", location: "38.6214981079,-121.2450027466", bbox_area: 1.48e-6 },
    { display_name: "Prospect Park, Troy, NY, US", location: "42.7238404952,-73.6848761999", bbox_area: 4.96e-5 },
    { display_name: "Prospect Park Zoo, NY, US", location: "40.6650644169,-73.9649138921", bbox_area: 9.98e-6 },
    { display_name: "Prospect Park (incl. Brooklyn Botanic Garden), NY, US", location: "40.6619973854,-73.970479097", bbox_area: 4.19e-4 },
    { display_name: "Broken row", location: "", bbox_area: 1 },
  ];

  it("puts the biggest place whose name starts with the query first", () => {
    const ranked = rankPlaces("prospect park", rows);
    expect(ranked[0].label).toBe("Prospect Park (incl. Brooklyn Botanic Garden), NY, US");
    expect(ranked.at(-1)!.label).toBe("Prospect Hill Park, CA, US");
    expect(ranked).toHaveLength(4);
  });

  it("rounds coordinates to about a kilometre", () => {
    expect(rankPlaces("prospect park", rows)[0]).toMatchObject({ lat: 40.66, lng: -73.97 });
    expect(here(37.3349871, -122.0890123)).toMatchObject({ label: "37.33° N 122.09° W", lat: 37.33, lng: -122.09, radiusKm: 3 });
    expect(here(-33.86, 151.21).label).toBe("33.86° S 151.21° E");
    expect(round2(-0.005)).toBe(-0);
  });

  it("sizes the radius from the place's bounding box", () => {
    expect(radiusFor(0.00286)).toBe(3); // Rancho San Antonio
    expect(radiusFor(0.000419)).toBe(1); // Prospect Park
    expect(radiusFor(5)).toBe(10);
    expect(radiusFor(null)).toBe(3);
  });
});

describe("speciesCounts", () => {
  it("asks iNaturalist for research-grade counts in the month, around the rounded centre", async () => {
    const { fetcher, asked } = fakeFetch(() => ({ results: [] }));
    await speciesCounts({ ...PARK, lat: 37.33487, lng: -122.12146 }, 10, 3, fetcher);
    const q = asked[0].searchParams;
    expect(asked[0].pathname).toBe("/v1/observations/species_counts");
    expect([q.get("lat"), q.get("lng"), q.get("radius"), q.get("month"), q.get("quality_grade")]).toEqual(["37.33", "-122.12", "3", "10", "research"]);
  });

  it("widens the circle while too few species have articles", async () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ count: 1, taxon: { id: i, name: `S${i}`, wikipedia_url: "http://en.wikipedia.org/wiki/S" } }));
    const { fetcher, asked } = fakeFetch((url) => ({ results: rows(Number(url.searchParams.get("radius")) >= 8 ? 20 : 3) }));
    const { sightings, radiusKm } = await sightingsNear(PARK, 10, 12, fetcher);
    expect(asked.map((u) => u.searchParams.get("radius"))).toEqual(["3", "8"]);
    expect(radiusKm).toBe(8);
    expect(sightings).toHaveLength(20);
  });
});

describe("wikiExtract", () => {
  it("asks for the plain-text article with headings and reads the first page", async () => {
    const { fetcher, asked } = fakeFetch(() => ({ query: { pages: [{ title: "Toyon", extract: "Toyon is a shrub." }] } }));
    expect(await wikiExtract("Toyon", fetcher)).toBe("Toyon is a shrub.");
    const q = asked[0].searchParams;
    expect([q.get("prop"), q.get("explaintext"), q.get("exsectionformat"), q.get("origin")]).toEqual(["extracts", "1", "wiki", "*"]);
  });

  it("returns nothing for a missing page or a failed request", async () => {
    expect(await wikiExtract("Nope", fakeFetch(() => ({ query: { pages: [{ missing: true }] } })).fetcher)).toBe("");
    expect(await wikiExtract("Nope", fakeFetch(() => ({}), 500).fetcher)).toBe("");
  });
});

describe("forecast", () => {
  it("reads the day's high, low, rain chance and local sun times", async () => {
    const { fetcher, asked } = fakeFetch(() => ({
      daily: {
        temperature_2m_max: [73.6],
        temperature_2m_min: [51.2],
        precipitation_probability_max: [10],
        sunrise: ["2026-10-11T07:14"],
        sunset: ["2026-10-11T18:41"],
      },
    }));
    expect(await forecast(PARK, "2026-10-11", "F", fetcher)).toEqual({ unit: "F", high: 74, low: 51, rain: 10, sunrise: "07:14", sunset: "18:41" });
    expect(asked[0].searchParams.get("temperature_unit")).toBe("fahrenheit");
    expect(asked[0].searchParams.get("timezone")).toBe("auto");
  });

  it("returns null outside the forecast range", async () => {
    expect(await forecast(PARK, "2027-01-01", "C", fakeFetch(() => ({ error: true }), 400).fetcher)).toBeNull();
  });
});

describe("mapLimit", () => {
  it("keeps order and never runs more than the limit at once", async () => {
    let running = 0;
    let most = 0;
    const out = await mapLimit([5, 1, 4, 2, 3], 2, async (x) => {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, x));
      running--;
      return x * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30]);
    expect(most).toBe(2);
  });
});
