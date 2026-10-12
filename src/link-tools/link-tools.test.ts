import {describe, expect, test} from "vitest";
import fc from "fast-check";
import {addUtm, decodeLinkSettings, linkTargets, linkToolsFor, withLinkTools} from "./index";

const utm = {source: "{platform}", medium: "social", campaign: "spring sale"};

describe("addUtm", () => {
  test("appends the three tags, Platform name in place of {platform}", () => {
    expect(addUtm("https://acme.com/shop", utm, "linkedin")).toBe(
      "https://acme.com/shop?utm_source=linkedin&utm_medium=social&utm_campaign=spring%20sale",
    );
  });

  test("keeps the existing query and hash as written; twitter reads as x", () => {
    expect(addUtm("https://acme.com/a?q=a+b&x=%20#top", utm, "twitter")).toBe(
      "https://acme.com/a?q=a+b&x=%20&utm_source=x&utm_medium=social&utm_campaign=spring%20sale#top",
    );
  });

  test("a tag already in the link is not replaced", () => {
    expect(addUtm("https://acme.com/?utm_source=news", utm, "x")).toBe(
      "https://acme.com/?utm_source=news&utm_medium=social&utm_campaign=spring%20sale",
    );
  });

  test("no values or an unparsable link: unchanged", () => {
    expect(addUtm("https://acme.com", {}, "x")).toBe("https://acme.com");
    expect(addUtm("https://", utm, "x")).toBe("https://");
  });
});

describe("withLinkTools", () => {
  const tools = {utm};

  test("no tools: the text is returned as is", () => {
    const text = "See https://acme.com.";

    expect(withLinkTools(text, "x", undefined)).toBe(text);
  });

  test("tags every link and keeps sentence punctuation outside the link", () => {
    const text = "New: https://acme.com/a, and (https://acme.com/b). Wiki https://en.wikipedia.org/wiki/A_(b)!";

    expect(withLinkTools(text, "x", {utm: {source: "ns"}})).toBe(
      "New: https://acme.com/a?utm_source=ns, and (https://acme.com/b?utm_source=ns). " +
        "Wiki https://en.wikipedia.org/wiki/A_(b)?utm_source=ns!",
    );
  });

  test("a short link replaces the tagged link", () => {
    const tagged = addUtm("https://acme.com/shop", utm, "x");
    const out = withLinkTools("Buy https://acme.com/shop now", "x", {...tools, short: {[tagged]: "https://go.example/abc"}});

    expect(out).toBe("Buy https://go.example/abc now");
  });

});

describe("withLinkTools properties", () => {
  const tools = {utm};

  test("text without links never changes", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        fc.pre(!/https?:\/\//i.test(text));
        expect(withLinkTools(text, "x", tools)).toBe(text);
      }),
    );
  });

  test("a tagged link keeps the original link as its prefix", () => {
    fc.assert(
      fc.property(fc.webUrl({withQueryParameters: true}), (url) => {
        fc.pre(!/[.,;:!?'")]$/.test(url) && !/[\s<>"'`]/.test(url));
        expect(withLinkTools(url, "x", tools).startsWith(url.split("#")[0] ?? url)).toBe(true);
      }),
    );
  });
});

describe("linkTargets", () => {
  test("one tagged link per link and Platform, without repeats", () => {
    const texts = ["https://acme.com and https://acme.com", undefined, "https://b.io"];

    expect(linkTargets(texts, ["x", "linkedin"], {source: "{platform}"})).toEqual([
      "https://acme.com?utm_source=x",
      "https://b.io?utm_source=x",
      "https://acme.com?utm_source=linkedin",
      "https://b.io?utm_source=linkedin",
    ]);
  });
});

describe("settings", () => {
  test("decodeLinkSettings takes the stored shape and throws on a wrong one", () => {
    expect(decodeLinkSettings({utm: {source: "ns"}, shorten: true})).toEqual({utm: {source: "ns"}, shorten: true});
    expect(() => decodeLinkSettings({shorten: "yes"})).toThrow();
    expect(() => decodeLinkSettings({utm: {source: "x".repeat(201)}})).toThrow();
  });

  test("linkToolsFor: Page values win; nothing set gives undefined", () => {
    const settings = {utm: {source: "ns", campaign: "db"}};

    expect(linkToolsFor(settings, {campaign: " launch "})).toEqual({utm: {source: "ns", medium: undefined, campaign: "launch"}});
    expect(linkToolsFor(settings, {campaign: "  "})?.utm.campaign).toBe("db");
    expect(linkToolsFor(undefined, {})).toBeUndefined();
    expect(linkToolsFor({utm: {source: " "}}, {})).toBeUndefined();
    expect(linkToolsFor({shorten: true}, {})).toEqual({utm: {source: undefined, medium: undefined, campaign: undefined}});
  });
});
