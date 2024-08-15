import {SocialPlatformTypes} from "types";

export const dev = process.env.NODE_ENV == "development";
export const prod = process.env.NODE_ENV == "production";
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

export const maxMediaSize = {
  MB: Number(process.env.MAX_MEDIA_SIZE_LIMIT_MB) || 200,
  bytes: Number(process.env.MAX_MEDIA_SIZE_LIMIT_MB) * 1024 * 1024,
};
