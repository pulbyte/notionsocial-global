import {docMimeTypes, imageMimeTypes, videoMimeTypes} from "env";
import {ArrayElement, NotionFiles, PublishMedia} from "types";
import * as mime from "@alshdavid/mime-types";
import {notionRichTextParser} from "text";
import {
  getUrlContentHeaders,
  getGdriveContentHeaders,
  isBase64String,
  alterGDriveLink,
} from "./url";
const NotionMediaRefSpliiter = "%$";

export function getNotionMediaRef(url: string) {
  if (!url || typeof url != "string") return url;
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    return path.split("/").slice(1, 4).join(NotionMediaRefSpliiter);
  } catch (error) {
    console.log("getNotionMediaRef error:", error);
    return null;
  }
}
export function packMedia(
  url: string,
  name: string,
  type: "image" | "video" | "doc",
  mimeType: string,
  mediaRef: string,
  size?: number,
  caption?: string
): PublishMedia {
  return {mimeType, url, name: name, mediaRef, size, caption, type};
}
export function filterPublishMedia(media: PublishMedia[]) {
  let arr = media?.filter((v) => !!v.type);
  const docMedias = arr.filter((m) => m.type == "doc");
  if (docMedias.length > 0) arr = docMedias.slice(0, 1);
  else arr = arr.slice(0, 20);
  return arr;
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

export function getMediaFromNotionBlock(block): Promise<PublishMedia | null> {
  const {type} = block;
  if (type == "image" || type == "video") {
    return getMediaFromNotionFile(block[type]);
  } else return Promise.resolve(null);
}

export function getMediaFromNotionFile(
  file: ArrayElement<NotionFiles>
): Promise<PublishMedia> {
  return new Promise((resolve) => {
    const extUrl = file?.["external"]?.["url"];
    const gDriveMedia = alterGDriveLink(extUrl);

    const notionUrl = file?.["file"]?.url;
    const url = notionUrl || gDriveMedia?.url || extUrl;
    const isBase64 = isBase64String(url);
    if (!url || isBase64) return resolve(null);
    const urlData = new URL(url);

    // ? Notion files
    if (notionUrl) {
      const _pathSplit = urlData.pathname.split("/");
      const name = file?.name || _pathSplit[_pathSplit.length - 1];
      const mediaRef = getNotionMediaRef(notionUrl);
      const caption = notionRichTextParser(file?.["caption"]);
      getUrlContentHeaders(notionUrl)
        .then((headers) => {
          const packed = packMedia(
            notionUrl,
            name,
            headers.mediaType,
            headers.mimeType,
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
      const mediaRef = gDriveMedia.name;
      getGdriveContentHeaders(gDriveMedia.downloadUrl)
        .then((headers) => {
          const packed = packMedia(
            gDriveMedia.downloadUrl,
            headers.name,
            headers.mediaType,
            headers.mimeType,
            mediaRef,
            headers.contentLength
          );
          resolve(packed);
        })
        .catch((e) => {
          console.info("Error while fetching headers of Google Drive file", url, e);
          resolve(null);
        });
    } else if (extUrl) {
      getUrlContentHeaders(extUrl)
        .then((headers) => {
          if (headers.contentType && headers.contentLength) {
            const packed = packMedia(
              extUrl,
              headers.name,
              headers.mediaType,
              headers.mimeType,
              extUrl, // Using extUrl as mediaRef for external URLs
              headers.contentLength
            );
            resolve(packed);
          } else {
            resolve(null);
          }
        })
        .catch((e) => {
          console.info("Error while fetching headers of external URL", extUrl, e);
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
  const mediaRef = getNotionMediaRef(notionUrl);
  const caption = notionRichTextParser(file?.["caption"]);

  return {notionUrl, name, mediaRef, caption};
}

export function getStaticMediaFromNotionFile(
  file: ArrayElement<NotionFiles>
): PublishMedia | null {
  const fileInfo = getNotionFileInfo(file);

  if (!fileInfo) return null;

  const {notionUrl, name, mediaRef, caption} = fileInfo;

  // Get mime type from file extension
  const mimeType = name.split(".").pop().toLowerCase();
  const mediaType = getMediaTypeFromMimeType(mimeType);
  return packMedia(notionUrl, name, mediaType, mimeType, mediaRef, undefined, caption);
}
export function getStaticMediaFromNotionBlock(block): PublishMedia | null {
  const {type} = block;
  if (type == "image" || type == "video") {
    return getStaticMediaFromNotionFile(block[type]);
  }
  return null;
}
