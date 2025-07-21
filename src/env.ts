import {SocialPlatformType} from "@pulbyte/social-stack-lib";
import {NotionBlockType, QueueName, StorageBucketName} from "./types";
export const dev = ["development", "test"].includes(getEnv("NODE_ENV", "development"));
export const prod = getEnv("NODE_ENV", "development") == "production";
export const MAX_SCHEDULE_LIMIT = 30 * 60 * 60 * 24; // 30 days in seconds
export const GCP_PROJECT = "notionsocial";
export const GCP_LOCATION = "us-central1";
export const POST_QUEUE: QueueName = dev ? "dev-post-queue" : "post-schedule-queue";
export const supportedPlatforms: SocialPlatformType[] = [
  "x",
  "twitter",
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "threads",
  "gmb",
];
export const imageMimeTypes = ["png", "jpg", "jpeg", "webp", "gif"];
export const videoMimeTypes = [
  "mp4",
  "avi",
  "m4v",
  "webm",
  "wmv",
  "mpg",
  "ogv",
  "3gp",
  "3g2",
  "quicktime",
  "qt",
  "mov",
];
export const docMimeTypes = ["ppt", "pptx", "doc", "docx", "pdf", "xls", "xlsx", "txt", "csv"];

// Platform-specific supported media types
export const platformMimeTypeSupported = {
  x: {
    image: ["jpg", "png", "webp", "jpeg", "gif"],
    video: ["mp4"],
  },
  instagram: {
    image: ["jpg", "jpeg", "png"],
    video: ["mp4", "mov", "qt"],
  },
  facebook: {
    image: ["jpg", "jpeg", "png"],
    video: ["mov", "mp4", "qt"],
    storyImage: ["jpg", "jpeg", "png", "bmp", "gif", "tiff"],
  },
  linkedin: {
    image: ["jpg", "png", "gif", "jpeg"],
    video: ["mp4"],
    doc: ["ppt", "pptx", "doc", "docx", "pdf"],
    thumbnail: ["jpg", "png", "jpeg"],
  },
  tiktok: {
    image: ["webp", "jpeg", "jpg"],
    video: ["mp4", "webm", "mov", "qt"],
  },
  youtube: {
    image: imageMimeTypes, // YouTube uses images only for thumbnails
    video: videoMimeTypes, // Uses global videoMimeTypes
  },
  pinterest: {
    image: ["jpeg", "jpg", "png"],
    video: ["mp4", "m4v", "mov", "qt"],
  },
  threads: {
    image: ["jpg", "jpeg", "png", "gif", "webp"], // Based on Instagram's support
    video: ["mp4"], // Limited video support
  },
  bluesky: {
    image: ["jpg", "jpeg", "png", "gif", "webp"],
    video: ["mp4"],
  },
  gmb: {
    image: ["jpg", "jpeg", "png", "gif", "webp"],
    video: ["mp4", "mov", "avi"],
  },
};

function getEnv(key: string, defaultValue: any) {
  if (typeof process !== "undefined" && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  if (typeof globalThis !== "undefined" && (globalThis as any)[key] !== undefined) {
    return (globalThis as any)[key];
  }
  return defaultValue;
}

export const maxMediaSize = {
  MB: Number(getEnv("MAX_MEDIA_SIZE_LIMIT_MB", 300)),
  get bytes() {
    return this.MB * 1024 * 1024;
  },
};
export const SUPPORTED_NOTION_CONTENT_BLOCKS: NotionBlockType[] = [
  "paragraph",
  "video",
  "image",
  "divider",
  "embed",
  "to_do",
  "numbered_list_item",
  "bulleted_list_item",
  "heading_1",
  "heading_2",
  "heading_3",
  "quote",
  "code",
  "bookmark",
];
export const ProcessedMediaBucket: StorageBucketName = getEnv(
  "PROCESSED_MEDIA_BUCKET",
  "optimized-post-media"
);
export const SmAccTagFormats = [
  "{{ client.username }}",
  "{{ sm_acc.username }}",
  "{{ client.username }} : {{ sm_acc.username }}",
  "{{ sm_acc.username }} ({{ client.username }})",
];
