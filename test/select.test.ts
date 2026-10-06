import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fromSpeciesCounts, groupOf, pick, speciesFor } from "../src/select.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/rancho.json", import.meta.url), "utf8"));
const all = fromSpeciesCounts(fixture.species_counts);

describe("fromSpeciesCounts", () => {
  it("title-cases common names and maps iconic taxa to groups", () => {
    const brush = all.find((s) => s.scientific === "Baccharis pilularis")!;
    expect(brush.common).toBe("Coyote Brush");
    expect(all.find((s) => s.scientific === "Zonotrichia atricapilla")!.common).toBe("Golden-crowned Sparrow");
    expect(brush.group).toBe("plant");
    expect(groupOf("Arachnida")).toBe("insect");
    expect(groupOf("Mammalia")).toBe("other");
  });
});

describe("pick", () => {
  it("fills an hour's card with birds and plants, and keeps room for a fungus and an insect", () => {
    const card = pick(all, speciesFor(60));
    expect(card).toHaveLength(12);
    const count = (g: string) => card.filter((s) => s.group === g).length;
    expect(count("fungus")).toBe(1);
    expect(count("insect")).toBe(1);
    expect(count("bird")).toBeGreaterThanOrEqual(4);
    expect(count("plant")).toBeGreaterThanOrEqual(4);
  });

  it("orders by group, then by how often each was reported", () => {
    const card = pick(all, 12);
    const order = ["bird", "plant", "fungus", "insect", "other"];
    for (let i = 1; i < card.length; i++) {
      const a = card[i - 1];
      const b = card[i];
      const byGroup = order.indexOf(a.group) - order.indexOf(b.group);
      expect(byGroup < 0 || (byGroup === 0 && a.count >= b.count)).toBe(true);
    }
  });

  it("skips species without a Wikipedia article", () => {
    const noWiki = all.map((s, i) => (i % 2 ? { ...s, wikipediaUrl: null } : s));
    expect(pick(noWiki, 12).every((s) => s.wikipediaUrl)).toBe(true);
  });

  it("matches the walk length", () => {
    expect([30, 60, 120].map(speciesFor)).toEqual([8, 12, 16]);
  });
});
