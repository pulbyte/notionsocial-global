// What each platform accepts (#33). Values are the ones the code enforces today; a change here
// is a product decision, not a refactor.

export const SPEC_PLATFORMS = ["x", "facebook", "instagram", "linkedin", "youtube", "tiktok", "pinterest", "threads", "bluesky", "gmb"] as const;

export type SpecPlatform = (typeof SPEC_PLATFORMS)[number];

// utf16: String.length (what the code counts today); weighted: twitter-text weightedLength.
export type TextLimit = {max: number; unit: "utf16" | "weighted"};

// Accepted frame: width in px, aspect as "w:h" (narrowest to widest).
export type Frame = {width: {min: number; max: number}; aspect: {min: string; max: string}};

// Video length the platform accepts, in seconds; post-process trims or pads into it (#62).
export type VideoLength = {minSec: number; maxSec: number};

// A post option the user sets on the Page (a Notion property) or on the Account (#67).
// switch: the config/cutover module that turns it on.
export type PostOption = {
  id: string;
  label: string; // what the capability page shows
  setOn: "page" | "account";
  property?: string; // default Notion property name
  max?: number; // the option's own limit (LinkedIn images)
  defaultSec?: number; // used when the Page sets no value
  accountField?: string; // sm_accs field with the Account's default; a Page value overrides it (#232)
  values?: readonly string[]; // values the platform takes (trial reel strategy, X subscriptions)
  maxSec?: number; // the option's video length limit (X long video)
  switch: string;
};

// #73 Send to drafts: where a Draft post lands (shown on the Page), or why the API has none.
export type DraftSupport = {where: string} | {unsupported: string};

export type PlatformSpec = {
  text: TextLimit; // caption / description / post body
  threadChunk?: TextLimit; // threads split long text into posts of this size
  longText?: TextLimit; // X: one long post instead of a thread (tweet-cross-limit-action "long-tweet")
  title?: number;
  media: {max: number; videoMax: number; images: readonly string[]; videos: readonly string[]; docs?: readonly string[]};
  bytesMB?: {image?: number; video?: number; doc?: number; gif?: number};
  firstComment?: {max: number};
  hashtags?: {max: number}; // most hashtags one post may carry; the platform rejects more (#50)
  // post-process fits media into these (#108); story: story images, carousel: each carousel image (#62)
  frame?: {image?: Frame; video?: Frame; story?: Frame; carousel?: Frame};
  video?: VideoLength; // #62
  shortsMaxSec?: number; // YouTube: longest vertical video the app calls a Short (#108)
  options?: readonly PostOption[]; // #67
  draft: DraftSupport; // #73
};
