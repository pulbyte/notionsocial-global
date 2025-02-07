import {NotionBlockType, QueueName, SocialPlatformTypes, StorageBucketName} from "./types";
export const dev = ["development", "test"].includes(getEnv("NODE_ENV", "development"));
export const prod = getEnv("NODE_ENV", "development") == "production";
export const MAX_SCHEDULE_LIMIT = 30 * 60 * 60 * 24; // 30 days in seconds
export const GCP_PROJECT = "notionsocial";
export const GCP_LOCATION = "us-central1";
export const POST_QUEUE: QueueName = dev ? "dev-post-queue" : "post-schedule-queue";
export const supportedPlatforms: SocialPlatformTypes[] = [
  "twitter",
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "threads",
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
