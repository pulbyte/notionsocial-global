import type {PlatformSpec, PostOption, SpecPlatform} from "./schema";

export {SPEC_PLATFORMS, type DraftSupport, type Frame, type PlatformSpec, type PostOption, type SpecPlatform, type TextLimit, type VideoLength} from "./schema";

export {PLAN_SPEC, type PlanSpec} from "./plans";

export {codeForMessage, ERROR_CATALOGUE, explain, type CatalogueEntry, type ErrorCode, type ErrorFault, type Explained} from "./errors";

const IMG = ["jpg", "jpeg", "png"] as const;

// Facebook and Instagram take the same files (#108 decision 7: one list).
const META_MEDIA = {images: IMG, videos: ["mp4", "mov", "qt"]} as const;

// #67: every platform with a first comment takes the same delay option.
// #232: the account's default (minutes) applies when the page sets none.
const FIRST_COMMENT_DELAY: PostOption = {
  id: "first-comment-delay",
  label: "First comment delay: minutes or a date in the First Comment Delay property, else the account's default (45 seconds)",
  setOn: "page",
  property: "First Comment Delay",
  accountField: "first_comment_delay",
  defaultSec: 45,
  switch: "first-comment-delay",
};

// #73: a Page with Send to Drafts ticked goes to the platform's drafts, where the API has them.
// Sources (API docs, 2026-10-12): TikTok inbox/video/init + MEDIA_UPLOAD photos, YouTube private,
// Graph /videos DRAFT, /video_reels video_state DRAFT, /feed published=false; LinkedIn Posts
// lifecycleState; atproto app.bsky.draft.defs (embeds are device-bound).
const SEND_TO_DRAFTS: PostOption = {
  id: "draft",
  label: "Send to drafts: tick Send to Drafts on the Page to finish the post in the platform's app",
  setOn: "page",
  property: "Send to Drafts",
  switch: "platform-drafts",
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
    options: [
      FIRST_COMMENT_DELAY,
      // #232: X Premium accounts post videos up to 3 hours (help.x.com "Posting videos"); others 140 s.
      // values: the X subscription_type values that qualify.
      {
        id: "long-video",
        label: "Videos longer than 140 seconds on X Premium accounts (up to 3 hours)",
        setOn: "account",
        maxSec: 10800,
        values: ["Premium", "PremiumPlus"],
        switch: "x-long-video",
      },
    ],
    draft: {unsupported: "the X API has no drafts; a created post is live"},
  },
  facebook: {
    text: {max: 63206, unit: "utf16"},
    media: {max: 10, videoMax: 1, ...META_MEDIA},
    firstComment: {max: 8000},
    // story images are padded to 9:16 (#62)
    frame: {story: {width: {min: 720, max: 1080}, aspect: {min: "9:16", max: "9:16"}}},
    video: {minSec: 3, maxSec: 14400},
    options: [FIRST_COMMENT_DELAY, SEND_TO_DRAFTS],
    draft: {where: "unpublished on your Page: open Meta Business Suite > Content to finish it (stories have no drafts)"},
  },
  instagram: {
    text: {max: 2200, unit: "utf16"},
    media: {max: 10, videoMax: 1, ...META_MEDIA},
    firstComment: {max: 8000},
    options: [
      FIRST_COMMENT_DELAY,
      // #232: trial_params.graduation_strategy on the reel container; a checked box = MANUAL.
      {
        id: "trial-reel",
        label: "Trial reel: a reel marked in the Trial Reel property is shown to non-followers first",
        setOn: "page",
        property: "Trial Reel",
        values: ["MANUAL", "SS_PERFORMANCE"],
        switch: "instagram-trial-reels",
      },
    ],
    hashtags: {max: 30}, // Instagram rejects a caption with more (#50 pre-flight)
    frame: {
      image: {width: {min: 320, max: 1440}, aspect: {min: "3:4", max: "1.91:1"}},
      video: {width: {min: 1080, max: 1440}, aspect: {min: "4:5", max: "1.91:1"}},
    },
    video: {minSec: 3, maxSec: 900},
    draft: {unsupported: "the Instagram API has no drafts; a media container can only be published"},
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
    draft: {unsupported: "the LinkedIn Posts API accepts only PUBLISHED when a post is created"},
  },
  youtube: {
    text: {max: 5000, unit: "utf16"},
    title: 100,
    // images: thumbnail types the publisher sends (#108 decision 4)
    media: {max: 1, videoMax: 1, images: IMG, videos: ["mp4", "mov", "qt"]},
    bytesMB: {image: 2},
    shortsMaxSec: 60, // app copy; YouTube decides what is a Short, publish does not check it
    video: {minSec: 1, maxSec: 43200},
    options: [
      SEND_TO_DRAFTS,
      // #232: playlistItems.insert after the upload (scope youtube.force-ssl, already requested).
      {
        id: "playlist",
        label: "Playlist: the video is added to the playlist in the YouTube Playlist property, else the account's default",
        setOn: "page",
        property: "YouTube Playlist",
        accountField: "default_playlist",
        switch: "youtube-playlist",
      },
    ],
    draft: {where: "uploaded as private: open YouTube Studio to finish it and change the visibility"},
  },
  tiktok: {
    text: {max: 2200, unit: "utf16"},
    title: 90,
    media: {max: 35, videoMax: 1, images: ["webp", "jpeg", "jpg"], videos: ["mp4", "webm", "mov", "qt"]},
    video: {minSec: 3, maxSec: 600},
    options: [SEND_TO_DRAFTS],
    draft: {where: "in your TikTok inbox: open the TikTok app to add sound and post (paste the caption for videos)"},
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
    draft: {unsupported: "the Pinterest API has no draft pins; a created pin is live"},
  },
  threads: {
    text: {max: 500, unit: "utf16"},
    threadChunk: {max: 500, unit: "utf16"},
    // videos: what the publisher sends (#108 decision 2)
    media: {max: 10, videoMax: 1, images: ["jpg", "jpeg", "png", "gif", "webp"], videos: ["mp4", "mov", "qt"]},
    bytesMB: {image: 5},
    video: {minSec: 0, maxSec: 300},
    draft: {unsupported: "the Threads API has no drafts; a container can only be published"},
  },
  bluesky: {
    text: {max: 300, unit: "utf16"},
    threadChunk: {max: 300, unit: "utf16"},
    media: {max: 4, videoMax: 1, images: ["jpg", "jpeg", "png", "gif", "webp"], videos: ["mp4"]},
    bytesMB: {image: 1, video: 50},
    firstComment: {max: 300},
    video: {minSec: 0, maxSec: 180},
    options: [FIRST_COMMENT_DELAY],
    draft: {unsupported: "Bluesky drafts keep media as files on the device, so a server cannot attach images or video"},
  },
  gmb: {
    text: {max: 1500, unit: "utf16"},
    // images only, bmp included: what the publisher sends (#108 decision 3)
    media: {max: 1, videoMax: 0, images: ["jpg", "jpeg", "png", "gif", "bmp", "webp"], videos: []},
    bytesMB: {image: 25},
    draft: {unsupported: "the Business Profile API has no draft posts; a created post is live"},
  },
};

export const spec = (platform: SpecPlatform): PlatformSpec => PLATFORM_SPEC[platform];

// One post option of a platform by id (#67), e.g. postOption("linkedin", "images-20")?.max.
export const postOption = (platform: SpecPlatform, id: string): PostOption | undefined =>
  PLATFORM_SPEC[platform].options?.find((o) => o.id === id);

// For the app (capability page, preview): plain JSON, no functions.
export const platformSpecJson = (): string => JSON.stringify(PLATFORM_SPEC);
