import {docMimeTypes, imageMimeTypes, videoMimeTypes} from "./env";
import {ArrayElement, NotionFiles, Media, SocialPlatformTypes} from "./types";
import * as mime from "@alshdavid/mime-types";

import {notionRichTextParser, trimAndRemoveWhitespace} from "./text";
import {
  getUrlContentHeaders,
  getGdriveContentHeaders,
  isBase64String,
  alterGDriveLink,
  alterDescriptLink,
  isDescriptLink,
} from "./url";

export function getMediaRef(url: string) {
  if (!url || typeof url != "string") return null;
  try {
    const {pathname} = new URL(url);
    return trimAndRemoveWhitespace(
      decodeURIComponent(pathname).split("/").slice(-3).filter(Boolean).join("_")
    );
  } catch (error) {
    return null;
  }
}

export function packMedia(
  url: string,
  name: string,
  type: "image" | "video" | "doc",
  mimeType: string,
  contentType: string,
  refId: string,
  size?: number,
  caption?: string
): Media {
  return {mimeType, url, name, refId, size, type, contentType, ...(caption ? {caption} : {})};
}
export function filterPublishMedia(media: Media[], smAccPlatforms: SocialPlatformTypes[]) {
  if (!media || !Array.isArray(media)) return [];

  let _ = media.filter((v) => !!v.type);
  const docs = _.filter((m) => m.type == "doc");

  const singleSmAcc = smAccPlatforms.length == 1;
  const hasLinkedin = smAccPlatforms.includes("linkedin");
  const onlyLinkedIn = singleSmAcc && hasLinkedin;

  if (docs.length > 0) {
    if (onlyLinkedIn) _ = docs.slice(0, 1);
    else if (!hasLinkedin) {
      _ = _.filter((m) => m.type != "doc");
    }
  } else _ = _.slice(0, 20);
  return _;
}
export function getContentTypeFromMimeType(mt) {
  return mime.lookup(mt)?.[0] || null;
}
export function getMimeTypeFromContentType(ct) {
  return mime.extension(ct)?.[0] || null;
}
export function getMediaTypeFromMimeType(mt) {
  if (!mt) return null;
  if (imageMimeTypes.includes(mt)) return "image";
  else if (videoMimeTypes.includes(mt)) return "video";
  else if (docMimeTypes.includes(mt)) return "doc";
  else return null;
}
export function getMediaTypeFromContentType(ct: string) {
  if (!ct) return null;
  if (ct?.includes("image")) return "image";
  else if (ct?.includes("video")) return "video";
  else if (ct?.includes("application")) return "doc";
  else {
    const mt = getMimeTypeFromContentType(ct);
    return getMediaTypeFromMimeType(mt);
  }
}

export const binaryUploadSocialPlatforms = ["twitter", "linkedin", "youtube", "tiktok"];
export const urlUploadSocialPlatforms = ["facebook", "instagram", "pinterest", "threads"];

export const mediaMimeTypes = imageMimeTypes.concat(videoMimeTypes).concat(docMimeTypes);

export function getMediaMimeType(file) {
  const split = file.split(".");
  let mimetype = split[split.length - 1];
  if (mimetype == "jpg") mimetype = "jpeg";
  return mimetype;
}

export function getMediaFromNotionBlock(block): Promise<Media | null> {
  const {type} = block;
  if (type == "image" || type == "video") {
    return getMediaFromNotionFile(block[type]);
  } else return Promise.resolve(null);
}

export function getNotionMediaName(str: string, mimeType: string) {
  if (!str || !mimeType) return null;
  return str.split(`.${mimeType}`)[0];
}

export function getMediaFromNotionFile(file: ArrayElement<NotionFiles>): Promise<Media> {
  return new Promise((resolve) => {
    const extUrl = file?.["external"]?.["url"] as string;
    const gDriveMedia = alterGDriveLink(extUrl);

    const notionUrl = file?.["file"]?.url;
    const url = notionUrl || gDriveMedia?.url || extUrl;
    const isBase64 = isBase64String(url);
    if (!url || isBase64) return resolve(null);
    const urlData = new URL(url);
    const mediaRef = getMediaRef(url);
    // ? Notion files
    if (notionUrl) {
      const _pathSplit = urlData.pathname.split("/");
      const name = file?.name || _pathSplit[_pathSplit.length - 1];
      const caption = notionRichTextParser(file?.["caption"]);
      getUrlContentHeaders(notionUrl)
        .then((headers) => {
          const packed = packMedia(
            notionUrl,
            name,
            headers.mediaType,
            headers.mimeType,
            headers.contentType,
            mediaRef,
            headers.contentLength,
            caption
          );
          resolve(packed);
        })
        .catch((e) => {
          console.info("Error while fetching headers of a URL", url, e);
          resolve(null);
        });
    }
    // ? Google Drive Files
    else if (gDriveMedia) {
      getGdriveContentHeaders(gDriveMedia.downloadUrl)
        .then((headers) => {
          const packed = packMedia(
            gDriveMedia.downloadUrl,
            headers.name,
            headers.mediaType,
            headers.mimeType,
            headers.contentType,
            gDriveMedia.name,
            headers.contentLength
          );
          resolve(packed);
        })
        .catch((e) => {
          console.info("Error while fetching headers of Google Drive file", url, e);
          resolve(null);
        });
    } else if (extUrl) {
      (isDescriptLink(extUrl) ? alterDescriptLink(extUrl) : Promise.resolve(extUrl))
        .then((url) => getUrlContentHeaders(url))
        .then((headers) => {
          if (headers.contentType && headers.contentLength) {
            const packed = packMedia(
              headers.url,
              headers.name,
              headers.mediaType,
              headers.mimeType,
              headers.contentType,
              mediaRef, // Using extUrl as mediaRef for external URLs
              headers.contentLength
            );
            resolve(packed);
          } else {
            resolve(null);
          }
        })
        .catch((e) => {
          console.info("Error while fetching external URL", extUrl, e);
          resolve(null);
        });
    } else return resolve(null);
  });
}

// ! TODO:- Add extUrl and gdriveUrl support here
// Common utility function
export function getNotionFileInfo(file) {
  const notionUrl = file?.["file"]?.url;
  if (!notionUrl || isBase64String(notionUrl)) return null;

  const {pathname} = new URL(notionUrl);
  const imgName = decodeURIComponent(pathname.slice(7));

  const name = file?.name || imgName.split("/").pop();
  const mediaRef = getMediaRef(notionUrl);
  const caption = notionRichTextParser(file?.["caption"]);

  return {notionUrl, name, mediaRef, caption};
}

export function getStaticMediaFromNotionFile(file: ArrayElement<NotionFiles>): Media | null {
  const fileInfo = getNotionFileInfo(file);

  if (!fileInfo) return null;

  const {notionUrl, name, mediaRef, caption} = fileInfo;

  // Get mime type from file extension
  const mimeType = name.split(".").pop().toLowerCase();
  const contentType = getContentTypeFromMimeType(mimeType);
  const mediaType = getMediaTypeFromMimeType(mimeType);
  return packMedia(
    notionUrl,
    name,
    mediaType,
    mimeType,
    contentType,
    mediaRef,
    undefined,
    caption
  );
}
export function getStaticMediaFromNotionBlock(block): Media | null {
  const {type} = block;
  if (type == "image" || type == "video") {
    return getStaticMediaFromNotionFile(block[type]);
  }
  return null;
}
