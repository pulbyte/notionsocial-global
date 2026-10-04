// Prefixes users type before @ in a Platforms value, mapped to our platform and account kind.
// IN@ is what NotionSocial writes (text.ts getSmShortName); users also type IG@ (case
// ig-legacy-tag-prefix-mismatch). Kind "any" lets LI@ reach a page when no profile matches.

export type Kind = "profile" | "page" | "group" | "any";

export type Target = {platform: string; kind: Kind};

const PLATFORM_PREFIXES = new Map(Object.entries({
  IG: "instagram",
  IN: "instagram",
  INSTA: "instagram",
  INSTAGRAM: "instagram",
  X: "twitter",
  TW: "twitter",
  TWITTER: "twitter",
  FB: "facebook",
  FACEBOOK: "facebook",
  LI: "linkedin",
  LINKEDIN: "linkedin",
  TT: "tiktok",
  TIKTOK: "tiktok",
  TH: "threads",
  THREADS: "threads",
  BSKY: "bluesky",
  BLUESKY: "bluesky",
  PIN: "pinterest",
  PINTEREST: "pinterest",
  YT: "youtube",
  YOUTUBE: "youtube",
  GMB: "gmb",
}));

const KIND_SUFFIXES = new Map<string, Kind>([
  ["PAGE", "page"],
  ["GROUP", "group"],
]);

// "LI-PAGE" -> linkedin page · "IG" -> instagram any · "NOPE" -> undefined
export function prefixTarget(prefix: string): Target | undefined {
  const [head = "", suffix] = prefix.toUpperCase().split("-");
  const platform = PLATFORM_PREFIXES.get(head);

  if (!platform) return undefined;

  if (suffix === undefined) return {platform, kind: "any"};

  const kind = KIND_SUFFIXES.get(suffix);

  return kind ? {platform, kind} : undefined;
}

// The prefix NotionSocial writes for each platform (same as text.ts getSmShortName).
const WRITTEN_PREFIX = new Map(Object.entries({
  facebook: "FB",
  instagram: "IN",
  linkedin: "LI",
  twitter: "TW",
  youtube: "YT",
  tiktok: "TIKTOK",
  pinterest: "PIN",
  threads: "THREADS",
  bluesky: "BSKY",
}));

export function writtenPrefix(platform: string): string {
  return WRITTEN_PREFIX.get(platform) ?? platform.toUpperCase();
}
