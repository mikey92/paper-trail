// Everything the card needs from the outside world comes from free, open services that
// answer a browser directly: iNaturalist (places, and what people saw there), Wikipedia
// (what each species looks like) and Open-Meteo (the weather). No keys, no server of ours.
// Each function takes the fetch to use, so tests and the Node eval can pass their own.

import { fromSpeciesCounts, type Sighting } from "./select.ts";

type Fetch = typeof fetch;

export interface Where {
  label: string;
  lat: number;
  lng: number;
  /** How far around the centre to count sightings: about half the place's width, 1–10 km. */
  radiusKm: number;
}

/** Two decimals is about a kilometre: enough to find the trail, not enough to find a house. */
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

interface PlaceRow { display_name: string; location: string; bbox_area?: number | null }

/** Radius for a place from its bounding-box area in square degrees. */
export function radiusFor(bboxArea: number | null | undefined): number {
  if (!bboxArea || bboxArea <= 0) return 3;
  const km = (Math.sqrt(bboxArea) * 111) / 2;
  return Math.min(10, Math.max(1, Math.round(km)));
}

/**
 * Places whose name starts with what was typed, biggest first, then the other matches.
 * iNaturalist's own places are parks and preserves people really record nature in, which
 * a town geocoder does not know ("Rancho San Antonio" is a preserve, not a village).
 */
export function rankPlaces(query: string, rows: PlaceRow[]): Where[] {
  const q = query.trim().toLowerCase();
  const starts = (r: PlaceRow) => r.display_name.toLowerCase().startsWith(q);
  return [...rows]
    .filter((r) => r.location?.includes(","))
    .sort((a, b) => Number(starts(b)) - Number(starts(a)) || (b.bbox_area ?? 0) - (a.bbox_area ?? 0))
    .map((r) => {
      const [lat, lng] = r.location.split(",").map(Number);
      return { label: r.display_name, lat: round2(lat), lng: round2(lng), radiusKm: radiusFor(r.bbox_area) };
    });
}

export async function searchPlaces(query: string, fetcher: Fetch = fetch): Promise<Where[]> {
  const url = `https://api.inaturalist.org/v1/places/autocomplete?q=${encodeURIComponent(query)}&per_page=20`;
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`Place search failed (${res.status}).`);
  const data = (await res.json()) as { results?: PlaceRow[] };
  return rankPlaces(query, data.results ?? []).slice(0, 6);
}

export function here(lat: number, lng: number): Where {
  return { label: `near ${round2(lat).toFixed(2)}, ${round2(lng).toFixed(2)}`, lat: round2(lat), lng: round2(lng), radiusKm: 3 };
}

/** Research-grade species counts within radiusKm of the centre, in the given month (1–12). */
export async function speciesCounts(where: Where, month: number, radiusKm: number, fetcher: Fetch = fetch): Promise<Sighting[]> {
  const params = new URLSearchParams({
    lat: String(round2(where.lat)),
    lng: String(round2(where.lng)),
    radius: String(radiusKm),
    month: String(month),
    quality_grade: "research",
    locale: "en",
    per_page: "200",
  });
  const res = await fetcher(`https://api.inaturalist.org/v1/observations/species_counts?${params}`);
  if (!res.ok) throw new Error(`iNaturalist did not answer (${res.status}).`);
  const data = (await res.json()) as { results?: Parameters<typeof fromSpeciesCounts>[0] };
  return fromSpeciesCounts(data.results ?? []);
}

/**
 * Enough species for the card: the place's own radius first, widened (×2.5, at most twice)
 * while fewer than `want` species with a Wikipedia article turn up.
 */
export async function sightingsNear(where: Where, month: number, want: number, fetcher: Fetch = fetch) {
  let radiusKm = where.radiusKm;
  let found = await speciesCounts(where, month, radiusKm, fetcher);
  for (let i = 0; i < 2 && found.filter((s) => s.wikipediaUrl).length < want; i++) {
    radiusKm = Math.round(radiusKm * 2.5);
    found = await speciesCounts(where, month, radiusKm, fetcher);
  }
  return { sightings: found, radiusKm };
}

const WIKI_HEADERS = { "Api-User-Agent": "PaperTrail/0.1 (https://github.com/mikey92/paper-trail)" };

/** The whole article as plain text with "== Heading ==" lines, or "" if there is none. */
export async function wikiExtract(title: string, fetcher: Fetch = fetch): Promise<string> {
  const params = new URLSearchParams({
    action: "query",
    prop: "extracts",
    explaintext: "1",
    exsectionformat: "wiki",
    redirects: "1",
    titles: title,
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  const res = await fetcher(`https://en.wikipedia.org/w/api.php?${params}`, { headers: WIKI_HEADERS });
  if (!res.ok) return "";
  const data = (await res.json()) as { query?: { pages?: { extract?: string }[] } };
  return data.query?.pages?.[0]?.extract ?? "";
}

export interface Weather {
  unit: "F" | "C";
  high: number;
  low: number;
  /** Highest chance of rain that day, in percent. */
  rain: number | null;
  /** Local wall-clock times at the place, "HH:MM". */
  sunrise: string;
  sunset: string;
}

/** The day's forecast at the place, or null when the date is outside the 16-day forecast. */
export async function forecast(where: Where, date: string, unit: "F" | "C", fetcher: Fetch = fetch): Promise<Weather | null> {
  const params = new URLSearchParams({
    latitude: String(round2(where.lat)),
    longitude: String(round2(where.lng)),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    timezone: "auto",
    start_date: date,
    end_date: date,
    temperature_unit: unit === "F" ? "fahrenheit" : "celsius",
  });
  const res = await fetcher(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) return null;
  const d = ((await res.json()) as { daily?: Record<string, (number | string | null)[]> }).daily;
  if (!d || d.temperature_2m_max?.[0] == null) return null;
  const time = (v: unknown) => String(v ?? "").slice(11, 16);
  return {
    unit,
    high: Math.round(Number(d.temperature_2m_max[0])),
    low: Math.round(Number(d.temperature_2m_min[0])),
    rain: d.precipitation_probability_max?.[0] == null ? null : Number(d.precipitation_probability_max[0]),
    sunrise: time(d.sunrise?.[0]),
    sunset: time(d.sunset?.[0]),
  };
}

/** Run `fn` over items with at most `limit` in flight, keeping the order of results. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
