import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cautionOf, descriptionOf, sections, splitSentences, titleFromUrl, visualSentences } from "../src/wiki.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/rancho.json", import.meta.url), "utf8")) as {
  descriptions: Record<string, { name: string; sections: string[]; desc: string }>;
};
const desc = (id: number) => fixture.descriptions[String(id)].desc;

const ARTICLE = [
  "The coast live oak is an evergreen oak native to California.",
  "",
  "== Description ==",
  "Coast live oak typically has a much-branched trunk.",
  "",
  "=== Leaf ===",
  "The leaves are dark green, oval, and often convex in shape, with spiny-toothed edges.",
  "",
  "=== Flower and fruit ===",
  "The acorns are slender and pointed, maturing in a single season.",
  "",
  "== Taxonomy ==",
  "It was described in 1801.",
].join("\n");

describe("sections", () => {
  it("splits on headings and keeps their level", () => {
    const s = sections(ARTICLE);
    expect(s.map((x) => [x.level, x.title])).toEqual([
      [1, ""],
      [2, "Description"],
      [3, "Leaf"],
      [3, "Flower and fruit"],
      [2, "Taxonomy"],
    ]);
    expect(s[2].text).toMatch(/^The leaves are dark green/);
  });
});

describe("descriptionOf", () => {
  it("takes the description with its subsections, then the lead, and stops at the next section", () => {
    const d = descriptionOf(ARTICLE);
    expect(d).toContain("much-branched trunk");
    expect(d).toContain("spiny-toothed edges");
    expect(d).toContain("slender and pointed");
    expect(d).toContain("evergreen oak native to California");
    expect(d).not.toContain("1801");
  });

  it("falls back to the lead when there is no description section", () => {
    expect(descriptionOf("A small bird.\n\n== Range ==\nEverywhere.")).toBe("A small bird.");
  });
});

describe("splitSentences", () => {
  it("drops unit conversions in brackets and reference marks", () => {
    expect(splitSentences("The tail is long (24.5 to 50.5 cm) and barred.[3] It sings.")).toEqual(["The tail is long and barred."]);
  });

  it("separates paragraphs that were joined without a space", () => {
    const s = splitSentences(desc(10094));
    expect(s).toContain("The bill is usually pale pinkish.");
  });

  it("drops a sentence cut off at the end of a paragraph", () => {
    const s = splitSentences(desc(906) + "\nThe wild turkey is a large bird.");
    expect(s.at(-1)).toBe("The wild turkey is a large bird.");
    expect(s.join(" ")).not.toContain("reddish-yellow");
  });
});

describe("visualSentences", () => {
  it("keeps what you can see or hear for the acorn woodpecker", () => {
    const s = visualSentences(desc(18209)).join(" ");
    expect(s).toContain("red cap");
    expect(s).toContain("laughing");
  });

  it("keeps the toothed leaves of toyon once the measurements are out of the way", () => {
    const s = visualSentences(desc(53405)).join(" ");
    expect(s).toContain("sharply toothed");
    expect(s).toContain("bright red");
  });

  it("stays within the length budget and keeps the article's order", () => {
    for (const { desc: d } of Object.values(fixture.descriptions)) {
      const s = visualSentences(d);
      expect(s.length).toBeGreaterThan(0);
      if (s.length > 1) expect(s.join(" ").length).toBeLessThanOrEqual(600 + s.length);
      const all = splitSentences(d);
      const at = s.map((x) => all.indexOf(x));
      expect([...at].sort((a, b) => a - b)).toEqual(at);
    }
  });
});

describe("cautionOf", () => {
  it("reads a rash warning as don't-touch", () => {
    expect(cautionOf("Poison oak.\n\n== Toxicity ==\nUrushiol causes an itchy rash.")).toBe("touch");
  });

  it("reads poisonous seeds as don't-eat", () => {
    expect(cautionOf(desc(53348))).toBe("eat");
  });

  it("finds a Toxicity section deep in the article", () => {
    const article = "A shrub.\n\n== Description ==\nRed berries.\n\n== Toxicity ==\nThe leaves contain cyanogenic glycosides and are toxic.";
    expect(cautionOf(article)).toBe("eat");
  });

  it("says nothing for a harmless article", () => {
    expect(cautionOf(desc(18209))).toBeNull();
  });
});

describe("titleFromUrl", () => {
  it("turns an article URL into a title", () => {
    expect(titleFromUrl("http://en.wikipedia.org/wiki/Wild_turkey")).toBe("Wild turkey");
    expect(titleFromUrl("https://en.wikipedia.org/wiki/Bewick%27s_wren")).toBe("Bewick's wren");
  });
});
