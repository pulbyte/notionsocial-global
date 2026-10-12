// Link tools (pulbyte/notionsocial-backend#82): UTM tags and short links in posted captions.
// Pure string work; the Notion page is never changed, only the text sent to the Platform.
import {Schema} from "effect";
import {LinkSettings, type LinkTools, type Utm} from "./schema";

export type {LinkSettings, LinkTools, Utm} from "./schema";

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/gi;

const TRAILING = /[.,;:!?'"]$/;

const KEYS = [
  ["utm_source", "source"],
  ["utm_medium", "medium"],
  ["utm_campaign", "campaign"],
] as const;

// Stored notion_dbs.link_tools or a DB settings request body; throws on a wrong shape.
export const decodeLinkSettings = Schema.decodeUnknownSync(LinkSettings);

// The UTM values a Page publishes with: the Page's own values win over the database's.
// Undefined when there is nothing to do, so the caption stays as it was.
export function linkToolsFor(settings: LinkSettings | undefined, page: Utm): LinkTools | undefined {
  const pick = (field: keyof Utm) => page[field]?.trim() || settings?.utm?.[field]?.trim() || undefined;
  const utm: Utm = {source: pick("source"), medium: pick("medium"), campaign: pick("campaign")};
  const tagged = KEYS.some(([, field]) => utm[field]);

  return tagged || settings?.shorten ? {utm} : undefined;
}

const platformName = (platform: string) => (platform === "twitter" ? "x" : platform);

// Punctuation that ends a sentence is not part of the link; ")" only when the link did not open one.
function trimUrl(raw: string): string {
  let url = raw;

  for (;;) {
    const closesOwnParen = url.endsWith(")") && url.split("(").length < url.split(")").length;

    if (!TRAILING.test(url) && !closesOwnParen) return url;
    url = url.slice(0, -1);
  }
}

// "utm_x=value" for each tag with a value that the link does not carry yet.
function missingTags(present: URLSearchParams, utm: Utm, platform: string): string[] {
  const tags: string[] = [];

  for (const [key, field] of KEYS) {
    const value = utm[field]?.replaceAll("{platform}", platformName(platform)).trim();

    if (value && !present.has(key)) tags.push(`${key}=${encodeURIComponent(value)}`);
  }

  return tags;
}

// Adds the missing utm_* parameters; the rest of the link stays exactly as the user wrote it.
export function addUtm(url: string, utm: Utm, platform: string): string {
  const present = URL.canParse(url) ? new URL(url).searchParams : undefined;
  const tags = present ? missingTags(present, utm, platform) : [];

  if (!tags.length) return url;

  const hash = url.indexOf("#");
  const base = hash < 0 ? url : url.slice(0, hash);
  const sep = !base.includes("?") ? "?" : /[?&]$/.test(base) ? "" : "&";

  return `${base}${sep}${tags.join("&")}${hash < 0 ? "" : url.slice(hash)}`;
}

// The text with every http(s) link tagged and, when a short link exists for it, shortened.
export function withLinkTools(text: string, platform: string, tools: LinkTools | undefined): string {
  if (!tools || !text) return text;

  return text.replace(URL_IN_TEXT, (raw) => {
    const url = trimUrl(raw);
    const tagged = addUtm(url, tools.utm, platform);

    return (tools.short?.[tagged] ?? tagged) + raw.slice(url.length);
  });
}

const linksIn = (text: string | undefined) => (text?.match(URL_IN_TEXT) ?? []).map(trimUrl);

// Every tagged link the texts produce across the Platforms: what the shortener gets asked for.
export function linkTargets(texts: readonly (string | undefined)[], platforms: readonly string[], utm: Utm): string[] {
  const urls = texts.flatMap(linksIn);
  const targets = platforms.flatMap((platform) => urls.map((url) => addUtm(url, utm, platform)));

  return [...new Set(targets)];
}
