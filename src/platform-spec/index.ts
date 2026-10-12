import type {PlatformSpec, PostOption, SpecPlatform} from "./schema";

export {SPEC_PLATFORMS, type Frame, type PlatformSpec, type PostOption, type SpecPlatform, type TextLimit, type VideoLength} from "./schema";

export {PLAN_SPEC, type PlanSpec} from "./plans";

export {codeForMessage, ERROR_CATALOGUE, explain, type CatalogueEntry, type ErrorCode, type ErrorFault, type Explained} from "./errors";

const IMG = ["jpg", "jpeg", "png"] as const;

// Facebook and Instagram take the same files (#108 decision 7: one list).
const META_MEDIA = {images: IMG, videos: ["mp4", "mov", "qt"]} as const;

// #67: every platform with a first comment takes the same delay option.
const FIRST_COMMENT_DELAY: PostOption = {
  id: "first-comment-delay",
  label: "First comment delay: minutes or a date in the First Comment Delay property (default 45 seconds)",
  setOn: "page",
  property: "First Comment Delay",
  defaultSec: 45,
  switch: "first-comment-delay",
};

// Source of each value: survey 2026-10-05 on #33 (file:line in the issue comment).
// video (#62): each platform's documented API length; post-process trims or pads into it.
export const PLATFORM_SPEC: Record<SpecPlatform, PlatformSpec> = {
  x: {
    text: {max: 280, unit: "weighted"},
    threadChunk: {max: 280, unit: "weighted"},
    longText: {max: 25000, unit: "weighted"},
    media: {max: 4, videoMax: 1, images: ["gif", "jpg", "png", "webp", "jpeg"], videos: ["mp4"]},
    bytesMB: {image: 5, gif: 15, video: 512},
    firstComment: {max: 280},
    video: {minSec: 0.5, maxSec: 140},
    options: [FIRST_COMMENT_DELAY],
  },
  facebook: {
    text: {max: 63206, unit: "utf16"},
    media: {max: 10, videoMax: 1, ...META_MEDIA},
    firstComment: {max: 8000},
    // story images are padded to 9:16 (#62)
    frame: {story: {width: {min: 720, max: 1080}, aspect: {min: "9:16", max: "9:16"}}},
    video: {minSec: 3, maxSec: 14400},
    options: [FIRST_COMMENT_DELAY],
  },
  instagram: {
    text: {max: 2200, unit: "utf16"},
    media: {max: 10, videoMax: 1, ...META_MEDIA},
    firstComment: {max: 8000},
    options: [FIRST_COMMENT_DELAY],
    hashtags: {max: 30}, // Instagram rejects a caption with more (#50 pre-flight)
    frame: {
      image: {width: {min: 320, max: 1440}, aspect: {min: "3:4", max: "1.91:1"}},
      video: {width: {min: 1080, max: 1440}, aspect: {min: "4:5", max: "1.91:1"}},
    },
    video: {minSec: 3, maxSec: 900},
  },
  linkedin: {
    text: {max: 3000, unit: "utf16"},
    title: 200,
    media: {max: 10, videoMax: 1, images: ["jpg", "png", "gif", "jpeg"], videos: ["mp4"], docs: ["ppt", "pptx", "doc", "docx", "pdf"]},
    bytesMB: {image: 10, gif: 10, video: 500, doc: 100},
    firstComment: {max: 1250},
    video: {minSec: 3, maxSec: 1800},
    options: [
      // A multi-image post takes 2-20 images; media.max stays 10 until the switch is on.
      {id: "images-20", label: "Up to 20 images in one post", setOn: "page", max: 20, switch: "linkedin-images-20"},
      FIRST_COMMENT_DELAY,
    ],
  },
  youtube: {
    text: {max: 5000, unit: "utf16"},
    title: 100,
    // images: thumbnail types the publisher sends (#108 decision 4)
    media: {max: 1, videoMax: 1, images: IMG, videos: ["mp4", "mov", "qt"]},
    bytesMB: {image: 2},
    shortsMaxSec: 60, // app copy; YouTube decides what is a Short, publish does not check it
    video: {minSec: 1, maxSec: 43200},
  },
  tiktok: {
    text: {max: 2200, unit: "utf16"},
    title: 90,
    media: {max: 35, videoMax: 1, images: ["webp", "jpeg", "jpg"], videos: ["mp4", "webm", "mov", "qt"]},
    video: {minSec: 3, maxSec: 600},
  },
  pinterest: {
    text: {max: 500, unit: "utf16"},
    title: 100,
    media: {max: 5, videoMax: 1, images: ["jpeg", "jpg", "png"], videos: ["mp4", "m4v", "mov", "qt"]},
    // Pinterest rejects a carousel whose images differ in ratio; 2:3 is one of the two it takes (#62)
    frame: {carousel: {width: {min: 600, max: 1000}, aspect: {min: "2:3", max: "2:3"}}},
    video: {minSec: 4, maxSec: 900},
    options: [
      {
        id: "default-board",
        label: "Default board: a pin with an empty Board goes to the account's newest public board",
        setOn: "account",
        property: "Pinterest - Board",
        switch: "pinterest-default-board",
      },
    ],
  },
  threads: {
    text: {max: 500, unit: "utf16"},
    threadChunk: {max: 500, unit: "utf16"},
    // videos: what the publisher sends (#108 decision 2)
    media: {max: 10, videoMax: 1, images: ["jpg", "jpeg", "png", "gif", "webp"], videos: ["mp4", "mov", "qt"]},
    bytesMB: {image: 5},
    video: {minSec: 0, maxSec: 300},
  },
  bluesky: {
    text: {max: 300, unit: "utf16"},
    threadChunk: {max: 300, unit: "utf16"},
    media: {max: 4, videoMax: 1, images: ["jpg", "jpeg", "png", "gif", "webp"], videos: ["mp4"]},
    bytesMB: {image: 1, video: 50},
    firstComment: {max: 300},
    video: {minSec: 0, maxSec: 180},
    options: [FIRST_COMMENT_DELAY],
  },
  gmb: {
    text: {max: 1500, unit: "utf16"},
    // images only, bmp included: what the publisher sends (#108 decision 3)
    media: {max: 1, videoMax: 0, images: ["jpg", "jpeg", "png", "gif", "bmp", "webp"], videos: []},
    bytesMB: {image: 25},
  },
};

export const spec = (platform: SpecPlatform): PlatformSpec => PLATFORM_SPEC[platform];

// One post option of a platform by id (#67), e.g. postOption("linkedin", "images-20")?.max.
export const postOption = (platform: SpecPlatform, id: string): PostOption | undefined =>
  PLATFORM_SPEC[platform].options?.find((o) => o.id === id);

// For the app (capability page, preview): plain JSON, no functions.
export const platformSpecJson = (): string => JSON.stringify(PLATFORM_SPEC);
