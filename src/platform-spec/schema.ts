// What each platform accepts (#33). Values are the ones the code enforces today; a change here
// is a product decision, not a refactor.

export const SPEC_PLATFORMS = ["x", "facebook", "instagram", "linkedin", "youtube", "tiktok", "pinterest", "threads", "bluesky", "gmb"] as const;

export type SpecPlatform = (typeof SPEC_PLATFORMS)[number];

// utf16: String.length (what the code counts today); weighted: twitter-text weightedLength.
export type TextLimit = {max: number; unit: "utf16" | "weighted"};

// Accepted frame: width in px, aspect as "w:h" (narrowest to widest).
export type Frame = {width: {min: number; max: number}; aspect: {min: string; max: string}};

export type PlatformSpec = {
  text: TextLimit; // caption / description / post body
  threadChunk?: TextLimit; // threads split long text into posts of this size
  longText?: TextLimit; // X: one long post instead of a thread (tweet-cross-limit-action "long-tweet")
  title?: number;
  media: {max: number; videoMax: number; images: readonly string[]; videos: readonly string[]; docs?: readonly string[]};
  bytesMB?: {image?: number; video?: number; doc?: number; gif?: number};
  firstComment?: {max: number};
  frame?: {image?: Frame; video?: Frame}; // post-process fits media into these (#108)
};
