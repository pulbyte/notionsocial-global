import {SocialPlatformTypes} from "types";

export const dev = getEnv("NODE_ENV", "development") == "development";
export const prod = getEnv("NODE_ENV", "development") == "production";
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
