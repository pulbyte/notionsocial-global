// Caption text rules (#63). Pure string functions the legacy renderer (parser.ts, _richtext.ts,
// _post.ts) calls when FormattingOptions.captionFixes is on.

// Bold/italic come from Unicode math letters (U+1D400-1D7FF, italic h is U+210E); NFKC maps
// them back to ASCII. Every other character stays as written.
const STYLED = /[\u{1D400}-\u{1D7FF}\u{210E}]/gu;

export const plainText = (text: string): string => text.replace(STYLED, (c) => c.normalize("NFKC"));

// Formatted text over the limit: plain text when that fits, else unchanged (the old result).
export function fitText(text: string, max: number, measure: (s: string) => number = (s) => s.length): string {
  if (measure(text) <= max) return text;

  const plain = plainText(text);

  return measure(plain) <= max ? plain : text;
}

// A line of only dashes ("---", "—-", "- - -") marks a section break, like a divider block.
const DASH_LINE = /^\s*[-–—](?:\s*[-–—])+\s*$/;

export const isDashLine = (line: string): boolean => DASH_LINE.test(line);

export function splitOnDashLines(text: string): string[] {
  const sections: string[][] = [[]];

  for (const line of text.split("\n")) {
    if (isDashLine(line)) sections.push([]);
    else sections[sections.length - 1]?.push(line);
  }

  return sections.flatMap((lines) => {
    const section = lines.join("\n").trim();

    return section ? [section] : [];
  });
}

// Soft-break lines of a list item or to-do line up under the item's text, as Notion shows them.
export const indentSoftBreaks = (text: string, indent: string): string =>
  indent ? text.replace(/\n(?=[^\n])/g, `\n${indent}`) : text;

// Platforms cannot show a link title; post the URL in its place (also drops breaks inside titles).
export const linkToUrl = (title: string, url: string): string => (/^https?:\/\//.test(url) ? url : title);

type StoredFormatting = {add_line_break_on_paragraph_block?: boolean; disable_text_formatting?: boolean};

// The database setting wins; the account-wide setting fills in when the database has none.
export function formattingFrom(db: StoredFormatting | undefined, user: StoredFormatting | undefined) {
  return {
    addLineBreakOnParagraphBlock: db?.add_line_break_on_paragraph_block ?? user?.add_line_break_on_paragraph_block,
    disableTextFormatting: db?.disable_text_formatting ?? user?.disable_text_formatting,
  };
}
