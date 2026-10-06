import { describe, expect, it } from "vitest";
import { checkTip, cleanTip, colourPairs, fallbackTip, stem } from "../src/ground.ts";

const WOODPECKER = [
  "Acorn Woodpecker.",
  "Melanerpes formicivorus.",
  "The adult acorn woodpecker has a brownish-black head, back, wings and tail, white forehead, throat, belly and rump.",
  "The bird is mostly black, with adult males have a red cap starting at the forehead.",
  "White circles on their wings are visible when in flight.",
  "Acorn woodpeckers have a call that sounds almost like they are laughing.",
].join("\n");

describe("stem", () => {
  it("folds the plurals and endings a tip and its source disagree on", () => {
    expect(stem("berries")).toBe(stem("berry"));
    expect(stem("wings")).toBe(stem("wing"));
    expect(stem("patches")).toBe(stem("patch"));
    expect(stem("laughing")).toBe("laugh");
    expect(stem("hopping")).toBe(stem("hops"));
    expect(stem("spotted")).toBe(stem("spots"));
    expect(stem("falling")).toBe(stem("falls"));
  });
});

describe("checkTip", () => {
  it("passes a tip made of the source's words", () => {
    expect(checkTip("Look for a red cap, a white throat and a laughing call.", WOODPECKER)).toEqual({ ok: true, unsupported: [] });
  });

  it("flags a colour or habit the source never mentions", () => {
    const r = checkTip("Look for a bright yellow belly as it drums on trees.", WOODPECKER);
    expect(r.ok).toBe(false);
    expect(r.unsupported).toEqual(expect.arrayContaining(["bright", "yellow", "drums", "trees"]));
  });

  it("flags a number that is not in the source", () => {
    expect(checkTip("It has 3 white circles on its wings.", WOODPECKER).unsupported).toContain("3");
  });

  it("flags a colour moved to another part", () => {
    const r = checkTip("Look for a red back and white wings.", WOODPECKER);
    expect(r.ok).toBe(false);
    expect(r.unsupported).toEqual(["red back"]);
  });

  it("accepts a colour shared by two parts named in one sentence", () => {
    expect(checkTip("Look for a white throat and white belly.", WOODPECKER).ok).toBe(true);
  });
});

describe("colourPairs", () => {
  it("pairs each colour with the part after it, skipping other colours", () => {
    expect(colourPairs("black and white wings, a red cap")).toEqual([
      ["black", "wings"],
      ["white", "wings"],
      ["red", "cap"],
    ]);
  });
});

describe("cleanTip", () => {
  it("strips labels, bullets, quotes and the species name", () => {
    expect(cleanTip('**Tip:** "look for the red cap"')).toBe("Look for the red cap.");
    expect(cleanTip("- Listen for a laughing call\nMore text")).toBe("Listen for a laughing call.");
    expect(cleanTip("Acorn Woodpecker: look for the red cap.", "Acorn Woodpecker")).toBe("Look for the red cap.");
  });

  it("refuses an answer that is too long to be one line on the card", () => {
    expect(cleanTip("word ".repeat(30))).toBe("");
    expect(cleanTip("   \n  ")).toBe("");
  });
});

describe("fallbackTip", () => {
  it("prefers the first sentence short enough for the card", () => {
    const long = "This sentence is far too long to print on a card because it goes on and on about many things in detail.";
    expect(fallbackTip([long, "The seeds are poisonous."])).toBe("The seeds are poisonous.");
  });

  it("cuts the first sentence when none is short", () => {
    const long = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty.";
    expect(fallbackTip([long])).toBe("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen …");
  });
});
