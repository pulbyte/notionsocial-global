import {expect, test} from "vitest";
import {diffPaths} from "./index";

test("equal results have no diff paths", () => {
  expect(diffPaths({text: "a", media: [{url: "x"}]}, {text: "a", media: [{url: "x"}]})).toEqual([]);
});

test("names each differing leaf, extra key and array item", () => {
  const old = {text: "a", media: [{url: "x"}], tags: ["t"]};
  const next = {text: "b", media: [{url: "x"}, {url: "y"}], tags: ["t"], extra: 1};

  expect(diffPaths(old, next)).toEqual(["text", "media[1]", "extra"]);
});

test("different types at the root report (root)", () => {
  expect(diffPaths("a", ["a"])).toEqual(["(root)"]);
});
