import { describe, expect, it } from "vitest";
import { checkTip } from "../src/ground.ts";
import { quoteFor, sourceText, tipMessages, writeTip, type ChatMessage, type Generate } from "../src/llm.ts";

const JUNCO = { common: "Dark-eyed Junco", scientific: "Junco hyemalis" };
const SENTENCES = [
  "Adult dark-eyed juncos generally have gray heads, necks, and breasts, gray or brown backs and wings, and a white belly.",
  "The white outer tail feathers flash distinctively in flight and while hopping on the ground.",
  "The bill is usually pale pinkish.",
];

/** A stand-in for Gemma that answers from a script and records what it was asked. */
function scripted(...answers: string[]) {
  const seen: ChatMessage[][] = [];
  const generate: Generate = async (messages) => {
    seen.push(messages);
    return answers[seen.length - 1] ?? "";
  };
  return { generate, seen };
}

describe("tipMessages", () => {
  it("shows two worked examples, then the species and its sentences", () => {
    const m = tipMessages(JUNCO, SENTENCES);
    expect(m.map((x) => x.role)).toEqual(["user", "assistant", "user", "assistant", "user"]);
    expect(m[4].content).toContain("Species: Dark-eyed Junco (Junco hyemalis)");
    expect(m[4].content).toContain("- The bill is usually pale pinkish.");
  });

  it("uses example answers that pass their own check", () => {
    const m = tipMessages(JUNCO, SENTENCES);
    for (const i of [0, 2]) {
      const names = m[i].content.match(/Species: (.+) \((.+)\)/)!;
      const source = m[i].content.split("Source:")[1].split("\n\n")[0];
      expect(checkTip(m[i + 1].content, `${names[1]}. ${names[2]}.\n${source}`)).toEqual({ ok: true, unsupported: [] });
    }
  });
});

describe("writeTip", () => {
  it("keeps a grounded first answer", async () => {
    const { generate, seen } = scripted("Look for white outer tail feathers flashing as it hops on the ground.");
    const r = await writeTip(generate, JUNCO, SENTENCES);
    expect(r.by).toBe("gemma");
    expect(r.tip).toBe("Look for white outer tail feathers flashing as it hops on the ground.");
    expect(seen).toHaveLength(1);
  });

  it("names the unsupported words and keeps a grounded second answer", async () => {
    const { generate, seen } = scripted("Look for a black hood and yellow bill.", "Look for a gray head, a white belly and a pale pinkish bill.");
    const r = await writeTip(generate, JUNCO, SENTENCES);
    expect(r.by).toBe("gemma-retry");
    expect(r.attempts[0].unsupported).toEqual(expect.arrayContaining(["black", "hood", "yellow"]));
    const retry = seen[1].at(-1)!.content;
    expect(retry).toContain('"hood"');
    expect(seen[1].at(-2)).toEqual({ role: "assistant", content: "Look for a black hood and yellow bill." });
  });

  it("quotes the most visual short sentence when both answers fail", async () => {
    const { generate } = scripted("A tiny blue bird with a crest.", "It has a long curved red beak.");
    const r = await writeTip(generate, JUNCO, SENTENCES);
    expect(r.by).toBe("wikipedia");
    expect(r.tip).toBe("The white outer tail feathers flash distinctively in flight and while hopping on the ground.");
    expect(r.attempts).toHaveLength(2);
    const bland = ["Juncos are common.", "The white outer tail feathers flash in flight."];
    const twice = scripted("A tiny blue bird with a crest.", "A tiny blue bird with a crest.");
    expect((await writeTip(twice.generate, JUNCO, bland)).tip).toBe("The white outer tail feathers flash in flight.");
  });

  it("never quotes a sentence that only came along as context", async () => {
    const context = ["The duckling is able to fly 50–60 days after hatching.", "Its body feathers are a mottled brown and the bill is orange."];
    const { generate } = scripted("A tiny blue bird with a crest.", "A tiny blue bird with a crest.");
    expect((await writeTip(generate, JUNCO, context)).tip).toBe("Its body feathers are a mottled brown and the bill is orange.");
  });

  it("cuts the best sentence rather than quote a short one that says little", () => {
    const snakeroot = [
      "The flowers are a clean white color and after blooming, small seeds with fluffy white tails are released to blow in the wind.",
      "The plant can spread either by the wind dispersal of its seeds or by rhizomes.",
    ];
    expect(quoteFor(snakeroot)).toBe("The flowers are a clean white color and after blooming, small seeds with fluffy white tails are released …");
  });

  it("treats an empty or rambling answer as a failure", async () => {
    const { generate, seen } = scripted("", "word ".repeat(40));
    const r = await writeTip(generate, JUNCO, SENTENCES);
    expect(r.by).toBe("wikipedia");
    expect(seen[1].at(-1)!.content).toMatch(/at most 15 words/);
  });

  it("checks against the names as well as the sentences", () => {
    expect(sourceText(JUNCO, SENTENCES)).toMatch(/^Dark-eyed Junco\.\nJunco hyemalis\./);
  });
});
