import {extractUrlFromString} from "../src/_url";

const url = (text: string) => extractUrlFromString(text)[1];

test("trailing punctuation is not part of the link", () => {
  expect(url("Visit example.co.uk, for more")).toBe("example.co.uk");
  expect(url("See https://example.com/path.")).toBe("https://example.com/path");
  expect(url("Is it https://example.com/a?")).toBe("https://example.com/a");
  expect(url("Go to example.com!")).toBe("example.com");
});

test("links without trailing punctuation are unchanged", () => {
  expect(url("Read https://example.com/a/b?x=1&y=2 now")).toBe("https://example.com/a/b?x=1&y=2");
  expect(url("example.com")).toBe("example.com");
});
