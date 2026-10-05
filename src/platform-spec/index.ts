import type {PlatformSpec, SpecPlatform} from "./schema";

export {SPEC_PLATFORMS, type PlatformSpec, type SpecPlatform, type TextLimit} from "./schema";

const IMG = ["jpg", "jpeg", "png"] as const;

// Source of each value: survey 2026-10-05 on #33 (file:line in the issue comment).
export const PLATFORM_SPEC: Record<SpecPlatform, PlatformSpec> = {
  x: {
    text: {max: 280, unit: "weighted"},
    threadChunk: {max: 280, unit: "weighted"},
    media: {max: 4, videoMax: 1, images: ["gif", "jpg", "png", "webp", "jpeg"], videos: ["mp4"]},
    bytesMB: {image: 5, gif: 15, video: 512},
    firstComment: {max: 280},
  },
  facebook: {
    text: {max: 63206, unit: "utf16"},
    media: {max: 10, videoMax: 1, images: IMG, videos: ["mov", "mp4", "qt"]},
    firstComment: {max: 8000},
  },
  instagram: {
    text: {max: 2200, unit: "utf16"},
    media: {max: 10, videoMax: 1, images: IMG, videos: ["mp4", "mov", "qt"]},
    firstComment: {max: 8000},
  },
  linkedin: {
    text: {max: 3000, unit: "utf16"},
    title: 200,
    media: {max: 10, videoMax: 1, images: ["jpg", "png", "gif", "jpeg"], videos: ["mp4"], docs: ["ppt", "pptx", "doc", "docx", "pdf"]},
    bytesMB: {image: 10, gif: 10, video: 500, doc: 100},
    firstComment: {max: 1250},
  },
  youtube: {
    text: {max: 5000, unit: "utf16"},
    title: 100,
    media: {max: 1, videoMax: 1, images: IMG, videos: ["mp4", "mov", "qt"]},
    bytesMB: {image: 2},
  },
  tiktok: {
    text: {max: 2200, unit: "utf16"},
    title: 90,
    media: {max: 35, videoMax: 1, images: ["webp", "jpeg", "jpg"], videos: ["mp4", "webm", "mov", "qt"]},
  },
  pinterest: {
    text: {max: 500, unit: "utf16"},
    title: 100,
    media: {max: 5, videoMax: 1, images: ["jpeg", "jpg", "png"], videos: ["mp4", "m4v", "mov", "qt"]},
  },
  threads: {
    text: {max: 500, unit: "utf16"},
    threadChunk: {max: 500, unit: "utf16"},
    media: {max: 10, videoMax: 1, images: ["jpg", "jpeg", "png", "gif", "webp"], videos: ["mp4", "mov", "qt"]},
    bytesMB: {image: 5},
  },
  bluesky: {
    text: {max: 300, unit: "utf16"},
    threadChunk: {max: 300, unit: "utf16"},
    media: {max: 4, videoMax: 1, images: ["jpg", "jpeg", "png", "gif", "webp"], videos: ["mp4"]},
    bytesMB: {image: 1, video: 50},
    firstComment: {max: 300},
  },
  gmb: {
    text: {max: 1500, unit: "utf16"},
    media: {max: 1, videoMax: 0, images: ["jpg", "jpeg", "png", "gif", "bmp", "webp"], videos: []},
    bytesMB: {image: 25},
  },
};

export const spec = (platform: SpecPlatform): PlatformSpec => PLATFORM_SPEC[platform];

// For the app (capability page, preview): plain JSON, no functions.
export const platformSpecJson = (): string => JSON.stringify(PLATFORM_SPEC);
