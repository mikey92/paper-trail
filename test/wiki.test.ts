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

  it("does not take the IUCN Red List or a year for something to see", () => {
    expect(visualSentences("As of 2025, the western honey bee was assessed as Data Deficient on the IUCN Red List.")).toEqual([]);
    expect(visualSentences("It was described in 1801 from a red specimen.")).toEqual([]);
    expect(visualSentences("Unlike the snowy egret, it has a yellow bill and black legs.")).toEqual([]);
    expect(visualSentences("The flesh is soft, white to yellowish, with a mild or sour taste.")).toEqual([]);
    expect(visualSentences("Pycnoporus coccineus is a saprophytic, white-rot decomposer fungus.")).toEqual([]);
  });

  it("brings along the sentence an 'It is…' sentence depends on", () => {
    const d = "The cap is convex at first, then flat. It is smooth and sulphur yellow with an orange-brown centre and whitish margin. The stem is long.";
    expect(visualSentences(d, 90)).toEqual([
      "The cap is convex at first, then flat.",
      "It is smooth and sulphur yellow with an orange-brown centre and whitish margin.",
    ]);
  });

  it("leaves out sentences about other species from the comparison", () => {
    const d = [
      "Apart from size, the great egret can be distinguished from other white egrets by its yellow bill and black legs.",
      "The snowy egret is readily distinguished from the great egret because it has a black bill and yellow feet.",
      "The great blue heron is a bit larger, and has a thicker bill than that of the great egret.",
    ].join(" ");
    expect(visualSentences(d, 600, "Great Egret")).toEqual([
      "Apart from size, the great egret can be distinguished from other white egrets by its yellow bill and black legs.",
    ]);
  });

  it("returns nothing when no sentence says what to look or listen for", () => {
    expect(visualSentences("The palm warbler is a small songbird in the New World warbler family.")).toEqual([]);
  });

  it("stays within the length budget and keeps the article's order", () => {
    let empty = 0;
    for (const { desc: d } of Object.values(fixture.descriptions)) {
      const s = visualSentences(d);
      if (!s.length) empty++;
      // The budget, plus at most the sentences that "It is…" sentences depend on.
      if (s.length > 1) expect(s.join(" ").length).toBeLessThanOrEqual(900);
      const all = splitSentences(d);
      const at = s.map((x) => all.indexOf(x));
      expect([...at].sort((a, b) => a - b)).toEqual(at);
    }
    expect(empty).toBe(1); // the wild turkey snapshot stops mid-sentence, before any colour
    expect(visualSentences(desc(906))).toEqual([]);
  });
});

describe("cautionOf", () => {
  it("reads stinging hairs in the description as don't-touch", () => {
    expect(cautionOf("A plant.\n\n== Description ==\nThe leaves carry stinging hairs.")).toBe("touch");
  });

  it("reads a rash under a Toxicity heading as both", () => {
    expect(cautionOf("Poison oak.\n\n== Toxicity ==\nUrushiol causes an itchy rash.")).toBe("touch-eat");
  });

  it("reads poisonous seeds as don't-eat", () => {
    expect(cautionOf(desc(53348))).toBe("eat");
  });

  it("takes a Toxicity heading deep in the article as the warning", () => {
    const article = "A shrub.\n\n== Description ==\nRed berries.\n\n== Uses ==\nJelly.\n\n== Toxicity ==\nThe seeds contain cyanogenic glycosides.";
    expect(cautionOf(article)).toBe("eat");
  });

  it("ignores harm that belongs to other species or other uses", () => {
    expect(cautionOf("A puffball.\n\n== Similar species ==\nIt resembles the poisonous common earthball.")).toBeNull();
    expect(cautionOf("A tree.\n\n== Associated species ==\nThe poisonous death cap grows around the trunk.")).toBeNull();
    expect(cautionOf("A fern.\n\n== Utility ==\nHikers rub it on a rash from nettles.")).toBeNull();
    expect(cautionOf("A bee.\n\n== Pesticide toxicity ==\nNeonicotinoids are toxic to bees.")).toBeNull();
    expect(cautionOf("A puffball.\n\n== Edibility ==\nYoung ones can be mistaken for poisonous amanitas.")).toBeNull();
    const puffball = "A puffball.\n\n== Description ==\nWhite and round.\n\n=== Similar species ===\nIt resembles the poisonous earthball.";
    expect(cautionOf(puffball)).toBeNull();
    expect(descriptionOf(puffball)).not.toContain("earthball");
    expect(cautionOf("Western honey bees are used in studies of pesticide toxicity.")).toBeNull();
  });

  it("ignores a section that says the species is not toxic", () => {
    expect(cautionOf("A shrub.\n\n== Toxicity ==\nThe berries are not toxic to people.")).toBeNull();
  });

  it("finds a venomous sting in the description", () => {
    expect(cautionOf("An ant.\n\n== Description ==\nAdults have a venom-laced sting.")).toBe("bite");
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
