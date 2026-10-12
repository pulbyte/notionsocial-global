// Renders a fixture page the way publish does (content.ts -> _post.ts) and prints every
// Platform's caption as text, so a golden file shows any change in what users post (#63).
import {getContentFromNotionBlocksAsync} from "../../content";
import {getRichTextFromNotionBlocksSync} from "../../_richtext";
import {
  getBlueskyContent,
  getFacebookContent,
  getGmbContent,
  getInstagramContent,
  getLinkedInContent,
  getPinterestContent,
  getThreadsContent,
  getTikTokContent,
  getXContent,
  getYouTubeContent,
} from "../../_post";
import type {FormattingOptions, NotionPageContent, NotionPagePostConfig, RichTextContent} from "../../types";
import {toApi, type FixtureBlock} from "./blocks";

const noChildren = () => {
  throw new Error("fixtures carry children inline");
};

// Production path for text pages. Media blocks need network (headers), so pages with media go
// through the static parser, which shares every text rule with the async one.
export async function renderBody(blocks: FixtureBlock[], options: FormattingOptions = {}): Promise<RichTextContent> {
  const api = toApi(blocks);

  if (blocks.some((b) => b.type === "image")) return getRichTextFromNotionBlocksSync(api, options);

  const {richText} = await getContentFromNotionBlocksAsync(api, options, noChildren);

  return richText;
}

export function configFor(options: FormattingOptions = {}): NotionPagePostConfig {
  const config: Partial<NotionPagePostConfig> = {platformCaptions: {}, rules: {}, formattingOptions: options};

  // SAFETY: the Platform builders read only platformCaptions, rules, formattingOptions and _data?.
  return config as NotionPagePostConfig;
}

// A cut through a surrogate pair leaves half a character, which a UTF-8 file cannot hold.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

const show = (s: string | undefined) =>
  (s ?? "").replace(LONE_SURROGATE, (c) => `<U+${c.charCodeAt(0).toString(16).toUpperCase()}>`);

const thread = (posts: Array<{text?: string; media?: Array<{url: string}>}>) =>
  posts.map((t, i) => `[${i + 1}${t.media?.length ? ` +${t.media.length} media` : ""}]\n${show(t.text)}`).join("\n");

// One section per Platform; values are exactly what the publisher receives as text.
export function renderPlatforms(richText: RichTextContent, config: NotionPagePostConfig): string {
  const page: NotionPageContent = {richText, media: [], title: "Title"};

  const sections: Array<[string, string]> = [
    ["facebook", show(getFacebookContent(page, config).text)],
    ["instagram", show(getInstagramContent(page, config, true).caption)],
    ["linkedin", show(getLinkedInContent(page, config).text)],
    ["tiktok", show(getTikTokContent(page, config).description)],
    ["youtube", show(getYouTubeContent(page, config).description)],
    ["pinterest", show(getPinterestContent(page, config, []).description)],
    ["gmb", show(getGmbContent(page, config).summary)],
    ["threads", thread(getThreadsContent(page, config))],
    ["bluesky", thread(getBlueskyContent(page, config))],
    ["x", thread(getXContent(page, config))],
  ];

  return `${sections.map(([name, text]) => `===== ${name} (${text.length})\n${text}`).join("\n")}\n`;
}
