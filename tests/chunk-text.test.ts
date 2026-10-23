import {chunkText} from "../src/_content";

// Threads, Bluesky, Mastodon and X split long text into a thread; text with no spaces must split too.
describe("chunkText", () => {
  it("splits text with no spaces at a sentence end under the limit", () => {
    const sentence = "これは日本語の文です。"; // 11 chars
    const text = sentence.repeat(50); // 550 chars, no spaces
    const chunks = chunkText(text, 500);
    expect(chunks.length).toBe(2);
    expect(chunks.every((c) => c.length <= 500)).toBe(true);
    expect(chunks[0].endsWith("。")).toBe(true);
    expect(chunks.join("")).toBe(text);
  });

  it("prefers a line break and drops the break at the cut", () => {
    const text = "あ".repeat(300) + "\n" + "い".repeat(300);
    expect(chunkText(text, 500)).toEqual(["あ".repeat(300), "い".repeat(300)]);
  });

  it("cuts at the limit when there is no break, keeping emoji whole", () => {
    const text = "あ".repeat(499) + "😀" + "い".repeat(10);
    const chunks = chunkText(text, 500);
    expect(chunks.every((c) => c.length <= 500)).toBe(true);
    expect(chunks.join("")).toBe(text);
  });

  it("leaves spaced text split by words as before", () => {
    expect(chunkText("aaa bbb ccc", 7)).toEqual(["aaa bbb", "ccc"]);
    expect(chunkText("short", 500)).toEqual(["short"]);
  });
});
