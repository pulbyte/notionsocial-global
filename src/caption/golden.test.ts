// Golden tests (#63): every fixture page rendered for every Platform, per option set. A change
// in what users post shows up as a diff in golden/out/*.txt; update with `vitest -u` on purpose.
import {describe, expect, it} from "vitest";
import type {FormattingOptions} from "../types";
import {FIXTURES} from "./golden/fixtures";
import {configFor, renderBody, renderPlatforms} from "./golden/render";

const VARIANTS: Array<[string, FormattingOptions]> = [
  ["default", {}],
  ["line break per block", {addLineBreakOnParagraphBlock: true}],
  ["disable formatting", {disableTextFormatting: true}],
  ["caption fixes", {captionFixes: true}],
  ["caption fixes + line break per block", {captionFixes: true, addLineBreakOnParagraphBlock: true}],
];

describe("caption golden", () => {
  for (const fixture of FIXTURES) {
    it(fixture.name, async () => {
      const parts: string[] = [];

      for (const [label, options] of VARIANTS) {
        const richText = await renderBody(fixture.blocks(), options);
        parts.push(`########## ${label}\n${renderPlatforms(richText, configFor(options))}`);
      }

      await expect(parts.join("\n")).toMatchFileSnapshot(`./golden/out/${fixture.name}.txt`);
    });
  }
});
