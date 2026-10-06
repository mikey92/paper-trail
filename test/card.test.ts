import { describe, expect, it } from "vitest";
import { gather } from "../src/build.ts";
import { clock, esc, longDate, minus, renderCard } from "../src/card.ts";
import { fixtureFetch } from "./build.test.ts";

const PARK = { label: "Rancho San Antonio County Park and Open Space Preserve, US, CA", lat: 37.33, lng: -122.12, radiusKm: 3 };

describe("time helpers", () => {
  it("formats times for °F cards in 12-hour style and leaves °C ones alone", () => {
    expect(clock("18:41", "F")).toBe("6:41 pm");
    expect(clock("07:05", "F")).toBe("7:05 am");
    expect(clock("12:00", "F")).toBe("12:00 pm");
    expect(clock("00:30", "F")).toBe("12:30 am");
    expect(clock("18:41", "C")).toBe("18:41");
  });

  it("subtracts minutes without going below midnight", () => {
    expect(minus("18:41", 75)).toBe("17:26");
    expect(minus("00:10", 30)).toBe("00:00");
  });

  it("writes the date out in full", () => {
    expect(longDate("2026-10-11")).toBe("Sunday, October 11");
  });
});

describe("renderCard", () => {
  it("prints the place, weather, start time, groups, warnings and sources", async () => {
    const { card } = await gather(PARK, "2026-10-11", 60, "F", fixtureFetch);
    card.entries.forEach((e, i) => (e.by = i % 3 ? "gemma" : "wikipedia"));
    const html = renderCard(card, { modelLabel: "Gemma 3 1B", seconds: 41 });
    expect(html).toContain('<h2 class="title">Rancho San Antonio County Park and Open Space Preserve</h2>');
    expect(html).toContain("High 74°F, low 51°F · 10% chance of rain · sunrise 7:14 am · sunset 6:41 pm");
    expect(html).toContain("start by <b>5:26 pm</b>");
    expect(html).toContain("<h3>Birds</h3>");
    expect(html).toContain("Never eat a wild mushroom because of this card.");
    expect(html).toContain("Toxic and irritates skin: don’t touch or taste");
    expect(html).toContain("11 of the 30 species people reported within 3 km in past Octobers");
    expect(html).toContain("the 4 in quotation marks are those sentences");
    expect(html).toContain("This card took 41 seconds of screen time.");
    expect(html).toContain("CC BY-SA 4.0");
    expect(html.match(/class="tip">“/g)).toHaveLength(4);
    expect(html).toContain("Tips written by Gemma 3 1B in your browser, each checked word by word");
    const example = renderCard(card, { modelLabel: "Gemma 3 1B", seconds: null, madeWhere: "ahead of time for this example" });
    expect(example).toContain("Tips written by Gemma 3 1B ahead of time for this example, each checked");
    expect(example).not.toContain("screen time");
  });

  it("escapes everything that came from outside", async () => {
    const { card } = await gather(PARK, "2026-10-11", 30, "C", fixtureFetch);
    card.entries[0].sighting = { ...card.entries[0].sighting, common: '<img src=x onerror="alert(1)">' };
    card.entries[0].tip = "<script>alert(1)</script>";
    const html = renderCard(card, { modelLabel: null, seconds: null });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(esc(`"'&`)).toBe("&quot;&#39;&amp;");
  });

  it("says when there is no forecast yet", async () => {
    const { card } = await gather(PARK, "2026-10-11", 30, "C", fixtureFetch);
    card.weather = null;
    expect(renderCard(card, { modelLabel: null, seconds: null })).toContain("No forecast yet for this date");
  });
});
