import fc from "fast-check";
import {describe, expect, it, test} from "vitest";
import {string_to_unicode_variant as toUnicodeVariant} from "string-to-unicode-variant";
import {fitText, formattingFrom, indentSoftBreaks, isDashLine, linkToUrl, plainText, splitOnDashLines} from "./index";

const STYLES = ["bold sans", "italic sans", "bold italic sans"];

describe("plainText", () => {
  test("undoes every style the renderer applies", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z0-9 .,]{0,40}$/), fc.constantFrom(...STYLES), (s, style) => {
        expect(plainText(toUnicodeVariant(s, style))).toBe(s);
      }),
    );
  });

  it("leaves emoji, braille blanks and other scripts alone", () => {
    expect(plainText("⠀⠀• ✅ é ﬁ 日本")).toBe("⠀⠀• ✅ é ﬁ 日本");
  });
});

describe("fitText", () => {
  test("returns the text or its plain form, and the plain form only when it fits", () => {
    fc.assert(
      fc.property(fc.string({maxLength: 60}), fc.constantFrom(...STYLES), fc.integer({min: 0, max: 120}), (s, style, max) => {
        const formatted = toUnicodeVariant(s, style);
        const out = fitText(formatted, max);

        expect([formatted, plainText(formatted)]).toContain(out);

        if (out !== formatted) expect(out.length).toBeLessThanOrEqual(max);
      }),
    );
  });
});

describe("dash lines", () => {
  it("knows a section break from a dash in text", () => {
    expect(["---", "—-", " - - - ", "——"].map(isDashLine)).toEqual([true, true, true, true]);
    expect(["-", "9-5", "a — b", ""].map(isDashLine)).toEqual([false, false, false, false]);
  });

  it("splits text on dash lines and drops empty sections", () => {
    expect(splitOnDashLines("one\n---\n\ntwo\n—-\n---\nthree")).toEqual(["one", "two", "three"]);
  });
});

it("indentSoftBreaks indents continuation lines, not blank ones", () => {
  expect(indentSoftBreaks("a\nb\n\nc", "⠀⠀")).toBe("a\n⠀⠀b\n\n⠀⠀c");
  expect(indentSoftBreaks("a\nb", "")).toBe("a\nb");
});

it("linkToUrl keeps titles of non-web links", () => {
  expect(linkToUrl("site", "https://x.y/")).toBe("https://x.y/");
  expect(linkToUrl("page", "/0f1e")).toBe("page");
});

it("formattingFrom: the database value wins, the account value fills in", () => {
  const user = {add_line_break_on_paragraph_block: true, disable_text_formatting: true};

  expect(formattingFrom({add_line_break_on_paragraph_block: false}, user)).toEqual({
    addLineBreakOnParagraphBlock: false,
    disableTextFormatting: true,
  });
  expect(formattingFrom(undefined, undefined)).toEqual({addLineBreakOnParagraphBlock: undefined, disableTextFormatting: undefined});
});
