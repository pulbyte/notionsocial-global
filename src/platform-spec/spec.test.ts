import {expect, test} from "vitest";
import {PLAN_SPEC, PLATFORM_SPEC, platformSpecJson, postOption, SPEC_PLATFORMS, spec} from "./index";

// Pins the values publishers enforce today (#33 survey). Changing one is a product decision.
test("enforced limits", () => {
  const pinned = SPEC_PLATFORMS.map((p) => [p, spec(p).text.max, spec(p).media.max]);

  expect(pinned).toEqual([
    ["x", 280, 4],
    ["facebook", 63206, 10],
    ["instagram", 2200, 10],
    ["linkedin", 3000, 10],
    ["youtube", 5000, 1],
    ["tiktok", 2200, 35],
    ["pinterest", 500, 5],
    ["threads", 500, 10],
    ["bluesky", 300, 4],
    ["gmb", 1500, 1],
    ["mastodon", 500, 4],
    ["telegram", 4096, 10],
    ["reddit", 40000, 20],
  ]);
});

test("every platform lists image types and a sane media count", () => {
  for (const p of SPEC_PLATFORMS) {
    const s = PLATFORM_SPEC[p];
    expect(s.media.images.length).toBeGreaterThan(0);
    expect(s.media.max).toBeGreaterThanOrEqual(1);
    expect(s.media.videoMax).toBeLessThanOrEqual(s.media.max);
  }
});

test("the JSON export round-trips", () => {
  expect(JSON.parse(platformSpecJson())).toEqual(JSON.parse(JSON.stringify(PLATFORM_SPEC)));
});

// #108: post-process fits Instagram media into these; values equal its old ImgDimensions/VidDimensions.instagram.
test("instagram frame matches what post-process enforced", () => {
  expect(PLATFORM_SPEC.instagram.frame).toEqual({
    image: {width: {min: 320, max: 1440}, aspect: {min: "3:4", max: "1.91:1"}},
    video: {width: {min: 1080, max: 1440}, aspect: {min: "4:5", max: "1.91:1"}},
  });
});

// #62: post-process trims or pads video into these lengths and pads story / carousel images.
test("video lengths and fit frames", () => {
  expect(SPEC_PLATFORMS.map((p) => [p, spec(p).video?.minSec, spec(p).video?.maxSec])).toEqual([
    ["x", 0.5, 140],
    ["facebook", 3, 14400],
    ["instagram", 3, 900],
    ["linkedin", 3, 1800],
    ["youtube", 1, 43200],
    ["tiktok", 3, 600],
    ["pinterest", 4, 900],
    ["threads", 0, 300],
    ["bluesky", 0, 180],
    ["gmb", undefined, undefined],
    ["mastodon", 0, 86400],
    ["telegram", 0, 86400],
    ["reddit", 0, 900],
  ]);

  for (const p of SPEC_PLATFORMS) {
    const v = spec(p).video;

    if (v) expect(v.minSec).toBeLessThan(v.maxSec);

    expect(!!v).toBe(spec(p).media.videoMax > 0);
  }

  expect(PLATFORM_SPEC.facebook.frame?.story?.aspect).toEqual({min: "9:16", max: "9:16"});
  expect(PLATFORM_SPEC.pinterest.frame?.carousel?.aspect).toEqual({min: "2:3", max: "2:3"});
});

// #108 drift decisions (2026-10-12): the spec records what production does today.
test("file types follow what each publisher sends", () => {
  expect(PLATFORM_SPEC.facebook.media.images).toBe(PLATFORM_SPEC.instagram.media.images);
  expect(PLATFORM_SPEC.facebook.media.videos).toBe(PLATFORM_SPEC.instagram.media.videos);
  expect(PLATFORM_SPEC.instagram.media.videos).toEqual(["mp4", "mov", "qt"]);
  expect(PLATFORM_SPEC.threads.media.videos).toEqual(["mp4", "mov", "qt"]);
  expect(PLATFORM_SPEC.gmb.media).toMatchObject({videoMax: 0, videos: []});
  expect(PLATFORM_SPEC.gmb.media.images).toContain("bmp");
  expect(PLATFORM_SPEC.youtube.media.images).toEqual(["jpg", "jpeg", "png"]);
  expect(PLATFORM_SPEC.youtube.shortsMaxSec).toBe(60);
});

// #79 #80: Mastodon long text is a reply chain; Telegram text over the media caption goes alone.
test("mastodon and telegram", () => {
  expect(spec("mastodon").threadChunk?.max).toBe(spec("mastodon").text.max);
  expect(spec("telegram").mediaCaption).toBe(1024);
  expect(spec("telegram").mediaCaption).toBeLessThan(spec("telegram").text.max);
  expect(SPEC_PLATFORMS.filter((p) => spec(p).mediaCaption)).toEqual(["telegram"]);
});

test("plan caps are the plan table values", () => {
  expect(PLAN_SPEC).toEqual({
    free: {imageMB: 5, videoMB: 50, xThreads: false},
    basic: {imageMB: 30, videoMB: 500, xThreads: true},
    premium: {imageMB: 100, videoMB: 1000, xThreads: true},
  });
});

// #50: pre-flight blocks Instagram when the caption has more hashtags than this.
test("only instagram caps hashtags", () => {
  expect(SPEC_PLATFORMS.filter((p) => spec(p).hashtags).map((p) => [p, spec(p).hashtags?.max])).toEqual([["instagram", 30]]);
});

// #67: each post option has a spec entry the capability page lists, and its own cutover switch.
test("post options", () => {
  const ids = SPEC_PLATFORMS.flatMap((p) => (spec(p).options ?? []).map((o) => `${p}:${o.id}:${o.switch}`));
  expect(ids).toEqual([
    "x:first-comment-delay:first-comment-delay",
    "x:long-video:x-long-video",
    "facebook:first-comment-delay:first-comment-delay",
    "facebook:draft:platform-drafts",
    "instagram:first-comment-delay:first-comment-delay",
    "instagram:trial-reel:instagram-trial-reels",
    "linkedin:images-20:linkedin-images-20",
    "linkedin:first-comment-delay:first-comment-delay",
    "youtube:draft:platform-drafts",
    "youtube:playlist:youtube-playlist",
    "tiktok:draft:platform-drafts",
    "pinterest:default-board:pinterest-default-board",
    "bluesky:first-comment-delay:first-comment-delay",
    "reddit:subreddit:reddit",
    "reddit:flair:reddit",
  ]);

  expect(postOption("linkedin", "images-20")?.max).toBe(20);
  expect(postOption("x", "first-comment-delay")).toMatchObject({defaultSec: 45, property: "First Comment Delay"});
  expect(postOption("pinterest", "nope")).toBeUndefined();
  // #232
  expect(postOption("x", "first-comment-delay")?.accountField).toBe("first_comment_delay");
  expect(postOption("youtube", "playlist")).toMatchObject({property: "YouTube Playlist", accountField: "default_playlist"});
  expect(postOption("instagram", "trial-reel")?.values).toEqual(["MANUAL", "SS_PERFORMANCE"]);
  expect(postOption("x", "long-video")?.maxSec).toBeGreaterThan(spec("x").video?.maxSec ?? 0);

  // The delay option sits on every platform that takes a first comment, and only there.
  for (const p of SPEC_PLATFORMS) expect(!!postOption(p, "first-comment-delay")).toBe(!!spec(p).firstComment);
});

// #73: every platform says where a draft lands or why it has none; the option sits only where it lands.
test("drafts", () => {
  const where = SPEC_PLATFORMS.filter((p) => "where" in spec(p).draft);
  expect(where).toEqual(["facebook", "youtube", "tiktok"]);

  for (const p of SPEC_PLATFORMS) {
    const d = spec(p).draft;
    expect(("where" in d ? d.where : d.unsupported).length).toBeGreaterThan(30);
    expect(!!postOption(p, "draft")).toBe("where" in d);
  }

  expect(postOption("tiktok", "draft")).toMatchObject({property: "Send to Drafts", switch: "platform-drafts", setOn: "page"});
});
