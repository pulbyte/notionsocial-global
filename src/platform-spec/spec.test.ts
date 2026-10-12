import {expect, test} from "vitest";
import {PLAN_SPEC, PLATFORM_SPEC, platformSpecJson, SPEC_PLATFORMS, spec} from "./index";

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
