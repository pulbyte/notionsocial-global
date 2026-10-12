// Fixture pages for the caption golden tests (#63), modelled on the "Notion Content Test" page.
import {bullet, divider, empty, h1, h3, image, num, p, quote, rich, span, todo, type FixtureBlock} from "./blocks";

export type Fixture = {name: string; blocks: () => FixtureBlock[]};

const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras porttitor elit urna. ";

export const FIXTURES: Fixture[] = [
  {name: "paragraphs", blocks: () => [p("First paragraph."), p("Second paragraph."), p("Third paragraph.")]},
  {
    name: "line-breaks",
    blocks: () => [
      p("Soft break (Shift + Enter)\nNew line\n\nAfter one blank line"),
      p("Next block"),
      empty(),
      p("After one empty block"),
      empty(),
      empty(),
      p("After two empty blocks"),
      p("    Four leading spaces"),
    ],
  },
  {
    name: "formatting",
    blocks: () => [
      rich(span("Bold", {bold: true}), span(" and "), span("italic", {italic: true}), span(" and "), span("both", {bold: true, italic: true})),
      rich(span("Inline "), span("code", {code: true}), span(" stays plain")),
      p("snake_case_word and _underscored_ text"),
    ],
  },
  {
    name: "links",
    blocks: () => [
      p("Bare URL https://notionsocial.app/blog?a=1&b=2"),
      rich(span("Custom title → "), span("notionsocial", {}, "https://notionsocial.app/")),
      rich(span("Bold", {bold: true}), span(" text + bold URL "), span("https://notionsocial.app/", {bold: true}, "https://notionsocial.app/")),
      rich(span("Underscore URL "), span("https://notion_social.app/a_b", {}, "https://notion_social.app/a_b")),
      rich(span("Title with a break "), span("read\nmore", {}, "https://notionsocial.app/more")),
    ],
  },
  {
    name: "lists",
    blocks: () => [
      p("Numbered:"),
      num("One", [p("Child paragraph")]),
      num("Two bold", [], {bold: true}),
      num("Three", [num("Sub a"), num("Sub b\nsoft break in a child")]),
      num("Soft break\nin an item"),
      p("Bullets:"),
      bullet("Alpha", [bullet("Nested")]),
      bullet("Beta\nsecond line"),
      p("After the list"),
    ],
  },
  {
    name: "todos",
    blocks: () => [
      p("Checklist:"),
      todo("Unchecked item", false),
      todo("Checked item", true),
      todo("Bold item", false, {bold: true}),
      todo("Two lines\nin a to-do", false),
      p("Done."),
    ],
  },
  {
    name: "headings-quote",
    blocks: () => [h1("Heading one"), p("Body under heading."), h3("Small heading"), quote("A quote block"), p("End.")],
  },
  {
    name: "dividers",
    blocks: () => [p("Part one."), divider(), p("Part two."), divider(), divider(), p("Part three.")],
  },
  {
    name: "dash-text",
    blocks: () => [p("Before the dashes"), p("---"), p("After the dashes"), p("—-"), p("Range 9-5 and em—dash stay")],
  },
  {
    name: "inline-media",
    blocks: () => [
      p("Text before the image"),
      image("photo.jpg", "this is the caption @someone"),
      p("Text after the image"),
      divider(),
      image("second.png"),
      p("Second part"),
    ],
  },
  {
    name: "long-formatted",
    blocks: () => [rich(span("Headline in bold", {bold: true})), rich(span(LOREM.repeat(14), {bold: true})), p(LOREM.repeat(4))],
  },
  {
    name: "short-formatted-thread",
    blocks: () => [rich(span(LOREM.repeat(4), {bold: true})), divider(), rich(span(LOREM.repeat(2), {italic: true}))],
  },
];
