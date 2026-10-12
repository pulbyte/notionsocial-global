// Notion API block builders for caption fixtures (#63). The shapes match blocks.children.list
// (API 2025-09-03) with ids and timestamps replaced; only the fields the renderer reads vary.
import type {NotionBlock} from "../../types";

type Style = {bold?: boolean; italic?: boolean; code?: boolean};

export type Span = {
  type: "text";
  text: {content: string; link: {url: string} | null};
  annotations: Style & {strikethrough: boolean; underline: boolean; color: string};
  plain_text: string;
  href: string | null;
};

type BlockValue = {
  rich_text?: Span[];
  color?: string;
  checked?: boolean;
  is_toggleable?: boolean;
  caption?: Span[];
  type?: string;
  file?: {url: string; expiry_time: string};
};

type Parent = {type: "page_id"; page_id: string} | {type: "block_id"; block_id: string};

type FixtureBlock = {id: string; type: string; value: BlockValue; parent: Parent; children: FixtureBlock[]};

export function span(content: string, style: Style = {}, href: string | null = null): Span {
  return {
    type: "text",
    text: {content, link: href ? {url: href} : null},
    annotations: {bold: false, italic: false, code: false, ...style, strikethrough: false, underline: false, color: "default"},
    plain_text: content,
    href,
  };
}

let seq = 0;

function block(type: string, value: BlockValue, children: FixtureBlock[] = []): FixtureBlock {
  seq += 1;
  const id = `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  const parent: Parent = {type: "block_id", block_id: id};

  return {id, type, value, parent: {type: "page_id", page_id: "page"}, children: children.map((c) => ({...c, parent}))};
}

const isFixture = (v: FixtureBlock | BlockValue | string): v is FixtureBlock => v instanceof Object && "value" in v && "children" in v;

// One block as the API sends it; JSON.stringify applies it to nested children too.
function asApiBlock(b: FixtureBlock) {
  const meta = {object: "block", id: b.id, parent: b.parent, created_time: "2026-01-01T00:00:00.000Z", last_edited_time: "2026-01-01T00:00:00.000Z"};
  const flags = {has_children: b.children.length > 0, archived: false, in_trash: false, type: b.type, [b.type]: b.value};

  return b.children.length > 0 ? {...meta, ...flags, children: b.children} : {...meta, ...flags};
}

// The renderer reads blocks as the API sends them: JSON, typed as NotionBlock.
export const toApi = (blocks: FixtureBlock[]): NotionBlock[] =>
  JSON.parse(JSON.stringify(blocks, (_key, v: FixtureBlock | BlockValue | string) => (isFixture(v) ? asApiBlock(v) : v)));

const textValue = (spans: Span[]): BlockValue => ({rich_text: spans, color: "default"});

export const p = (text: string) => block("paragraph", textValue(text ? [span(text)] : []));

export const rich = (...spans: Span[]) => block("paragraph", textValue(spans));

export const empty = () => block("paragraph", textValue([]));

export const h1 = (text: string) => block("heading_1", {...textValue([span(text)]), is_toggleable: false});

export const h3 = (text: string) => block("heading_3", {...textValue([span(text)]), is_toggleable: false});

export const quote = (text: string) => block("quote", textValue([span(text)]));

export const bullet = (text: string, children: FixtureBlock[] = [], style: Style = {}) =>
  block("bulleted_list_item", textValue([span(text, style)]), children);

export const num = (text: string, children: FixtureBlock[] = [], style: Style = {}) =>
  block("numbered_list_item", textValue([span(text, style)]), children);

export const todo = (text: string, checked: boolean, style: Style = {}) =>
  block("to_do", {...textValue([span(text, style)]), checked});

export const divider = () => block("divider", {});

export const image = (name: string, caption = "") =>
  block("image", {
    caption: caption ? [span(caption)] : [],
    type: "file",
    file: {url: `https://files.example.com/${name}`, expiry_time: "2026-01-01T01:00:00.000Z"},
  });

export type {FixtureBlock};
