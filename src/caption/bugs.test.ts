// One fixture per caption bug in #63. Each pins today's output (captionFixes off) and the fixed
// output (captionFixes on: config/cutover."caption-fixes", set by the backend per publish).
import {describe, expect, it} from "vitest";
import {getRichTextFromText} from "../_richtext";
import {getFacebookContent, getInstagramContent, getThreadsContent, getXContent} from "../_post";
import type {FormattingOptions, NotionPageContent} from "../types";
import {divider, empty, image, num, p, rich, span, todo, type FixtureBlock} from "./golden/blocks";
import {configFor, renderBody} from "./golden/render";

const OLD: FormattingOptions = {addLineBreakOnParagraphBlock: true};
const NEW: FormattingOptions = {addLineBreakOnParagraphBlock: true, captionFixes: true};
const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras porttitor elit urna. ";

async function page(blocks: FixtureBlock[], options: FormattingOptions): Promise<NotionPageContent> {
  return {richText: await renderBody(blocks, options), media: [], title: "Title"};
}

async function both(blocks: () => FixtureBlock[], read: (c: NotionPageContent, o: FormattingOptions) => string) {
  return [read(await page(blocks(), OLD), OLD), read(await page(blocks(), NEW), NEW)];
}

const ig = (c: NotionPageContent, o: FormattingOptions) => getInstagramContent(c, configFor(o), true).caption;

const fb = (c: NotionPageContent, o: FormattingOptions) => getFacebookContent(c, configFor(o)).text;

const body = (c: NotionPageContent) => c.richText.text;

describe("caption bugs (#63)", () => {
  it("T07 IG line spacing: one empty block is one blank line", async () => {
    const [old, fixed] = await both(() => [p("Next block"), empty(), p("After")], ig);

    expect(old).toBe("Next block\n \n \nAfter\n");
    expect(fixed).toBe("Next block\n\nAfter");
  });

  it("T52 lists and to-dos: a soft break keeps the item's indent", async () => {
    const blocks = () => [num("Soft break\nin an item"), todo("Two lines\nin a to-do", false), num("Three", [num("Sub\nchild line")])];
    const [old, fixed] = await both(blocks, body);

    expect(old).toBe("1. Soft break\nin an item\n\n⬜ Two lines\nin a to-do\n\n1. Three\n⠀⠀a. Sub\nchild line\n");
    expect(fixed).toBe("1. Soft break\n⠀⠀in an item\n\n⬜ Two lines\n⠀⠀in a to-do\n\n1. Three\n⠀⠀a. Sub\n⠀⠀⠀⠀child line");
  });

  it("T52 inline media: no stray line break after an image", async () => {
    const blocks = () => [p("Before"), divider(), image("a.png"), p("Second part")];
    const [old, fixed] = await both(blocks, fb);

    expect(old).toBe("Before\n \n\n \nSecond part\n");
    expect(fixed).toBe("Before\n\nSecond part");
  });

  it("T54 '---' typed as text splits like a divider (Facebook gets a blank line)", async () => {
    const blocks = () => [p("Before"), p("---"), p("After"), p("—-"), p("Last")];
    const [old, fixed] = await both(blocks, fb);

    expect(old).toBe("Before\n\n---\n\nAfter\n\n—-\n\nLast\n");
    expect(fixed).toBe("Before\n\nAfter\n\nLast");
  });

  it("T54 '---' in the Caption property splits X posts", () => {
    const text = "Part one\n---\nPart two";
    const posts = (o: FormattingOptions) =>
      getXContent({richText: getRichTextFromText(text, undefined, o), media: []}, configFor(o)).map((t) => t.text);

    expect(posts(OLD)).toEqual(["Part one\n---\nPart two"]);
    expect(posts(NEW)).toEqual(["Part one", "Part two"]);
  });

  it("links: the URL replaces the link title, so no title or break is posted without it", async () => {
    const url = "https://notionsocial.app/more";
    const blocks = () => [rich(span("Read "), span("read\nmore", {}, url), span(" now"))];
    const [old, fixed] = await both(blocks, body);

    expect(old).toBe("Read read\nmore now\n");
    expect(fixed).toBe(`Read ${url} now`);
  });

  it("Threads: a formatted paragraph that fits as plain text is one post", async () => {
    const blocks = () => [rich(span(LOREM.repeat(4).trim(), {bold: true}))];
    const [old, fixed] = await both(blocks, (c, o) => String(getThreadsContent(c, configFor(o)).length));

    expect(old).toBe("2");
    expect(fixed).toBe("1");
  });
});

describe("formatted text over the limit (#63)", () => {
  const long = () => [rich(span(LOREM.repeat(16), {bold: true}))];

  it("falls back to plain text when that fits", async () => {
    const [old, fixed] = await both(long, ig);

    expect(old.length).toBeGreaterThan(2200);
    expect(fixed.length).toBeLessThanOrEqual(2200);
    expect(fixed).toBe(LOREM.repeat(16).trim());
  });

  it("keeps the formatted text when plain text is over the limit too", async () => {
    const [old, fixed] = await both(() => [rich(span(LOREM.repeat(30), {bold: true}))], ig);

    expect(fixed).toBe(old.trimEnd());
  });
});
