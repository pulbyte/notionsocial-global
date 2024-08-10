import _ from "lodash";
import {callFunctionsSequentially} from "./utils";
import {notionRichTextParser} from "./text";
import mime from "mime-types";
import {
  ArrayElement,
  NotionFiles,
  OptimizedMedia,
  PostRecord,
  PublishMedia,
  PublishMediaBuffer,
  SocialPostOptimizedMedia,
  SocialPostOptimizedMediaSrc,
} from "./types";
import {
  isBase64String,
  alterGDriveLink,
  getGdriveContentHeaders,
  getUrlContentHeaders,
} from "./url";

import {getCloudBucketFile} from "data";
import {formatBytesIntoReadable} from "text";
import {docMimeTypes, imageMimeTypes, maxMediaSize, videoMimeTypes} from "env";
import axios from "axios";

export const binaryUploadSocialPlatforms = ["twitter", "linkedin", "youtube", "tiktok"];
export const urlUploadSocialPlatforms = ["facebook", "instagram", "pinterest", "threads"];

export const mediaMimeTypes = imageMimeTypes.concat(videoMimeTypes).concat(docMimeTypes);

export function getMediaMimeType(file) {
  const split = file.split(".");
  let mimetype = split[split.length - 1];
  if (mimetype == "jpg") mimetype = "jpeg";
  return mimetype;
}

export function getMediaFromNotionFile(
  file: ArrayElement<NotionFiles>
): Promise<PublishMedia> {
  return new Promise((resolve) => {
    const extUrl = file?.["external"]?.["url"];
    const gDriveMedia = alterGDriveLink(extUrl);

    const notionUrl = file?.["file"]?.url;
    const url = notionUrl || gDriveMedia?.url;
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
            headers.mimeType,
            mediaRef,
            headers.contentLength,
            caption
          );
          resolve(packed);
        })
        .catch((e) => {
          console.info("Error while fetching headers of a URL", e);
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
            headers.mimeType,
            mediaRef,
            headers.contentLength
          );
          resolve(packed);
        })
        .catch((e) => {
          console.info("Error while fetching headers of Google Drive file", e);
          resolve(null);
        });
    } else return resolve(null);
  });
}
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
  mimeType: string,
  mediaRef: string,
  size?: number,
  caption?: string
): PublishMedia {
  const mediaType = getMediaTypeFromMimeType(mimeType);
  const obj = {mimeType, url, name: name, mediaRef, size, caption};
  if (mediaType == "image") {
    return {...obj, type: "image"};
  } else if (mediaType == "video") {
    return {...obj, type: "video"};
  } else if (mediaType == "doc") {
    return {...obj, type: "doc"};
  } else return null;
}

export const getMediaFromNotionFiles = (files: NotionFiles): Promise<PublishMedia[]> => {
  if (!files || files.length <= 0) {
    return Promise.resolve([]);
  } else {
    const mediaArr: PublishMedia[] = [];
    return callFunctionsSequentially(
      files.map(
        (file, index) => () =>
          getMediaFromNotionFile(file).then((media) => {
            mediaArr.splice(index, 0, media);
            return media;
          })
      )
    ).then(() => {
      return mediaArr.filter((media) => media != null);
    });
  }
};

export function filterPublishMedia(media: PublishMedia[]) {
  let arr = media?.filter((v) => mediaMimeTypes.includes(v.mimeType));
  // const vidMedias = arr.filter((m) => m.type == 'video')
  const docMedias = arr.filter((m) => m.type == "doc");
  if (docMedias.length > 0) arr = docMedias.slice(0, 1);
  // else if (vidMedias.length > 0) arr = vidMedias.slice(0, 1)
  else arr = arr.slice(0, 20);
  return arr;
}
export function findOptimizedMedia(
  file: PublishMedia,
  postRecord?: PostRecord
): OptimizedMedia & {mimeType: string; size: number} {
  if (!postRecord) return null;
  const optzed: SocialPostOptimizedMedia = _.find(postRecord?.optimized_media, {
    mediaRef: file.mediaRef,
  });
  if (!optzed) return null;
  const lossySrc: SocialPostOptimizedMediaSrc = _.find(optzed?.src, {
    optimization: "lossy-compression",
  });
  const losslessSrc: SocialPostOptimizedMediaSrc = _.find(optzed?.src, {
    optimization: "lossless-compression",
  });
  const optzdSrc = lossySrc || losslessSrc;
  if (!optzdSrc) return null;
  const mediaRef = optzed.mediaRef || optzdSrc.bucketFile;
  if (optzed && optzdSrc) {
    return {
      mediaRef,
      size: optzdSrc.size,
      mimeType: optzed.mimeType,
      optimizedLink: `https://storage.googleapis.com/optimized-post-media/${mediaRef}/${
        lossySrc ? "lossy" : "lossless"
      }-compression`,
      optimization: optzdSrc.optimization,
      optimizedSize: optzdSrc.size,
    };
  } else return null;
}

export function getContentType(mt) {
  switch (mt) {
    case "mp4":
      return "video/mp4";
    case "gif":
      return "image/gif";
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "jpg":
      return "image/jpeg";
    default:
      return mt;
  }
}

export function getMediaBuffer(media: PublishMedia) {
  if (!media.url) {
    return Promise.reject(new Error("No URL provided to download media file."));
  }
  const {pathname} = new URL(media.url);
  const name = media.name || pathname;
  console.info("+ Downloading a media file: ", media);

  return downloadFile(media.url, name);
}
export async function downloadFile(url, name) {
  if (!url || typeof url !== "string") {
    throw new Error("Invalid File URL provided");
  }

  const start = Date.now();
  try {
    const response = await axios({
      method: "get",
      url: url,
      responseType: "arraybuffer",
      timeout: 15 * 60 * 1000, // 15 minutes
      maxContentLength: maxMediaSize.bytes, // 100 MB max file size
    });

    const buffer = Buffer.from(response.data);
    const size = buffer.length;

    const duration = (Date.now() - start) / 1000;
    const speedMBps = size / duration / (1024 * 1024);

    console.info(
      `✓ Downloaded ${name}; Size: ${formatBytesIntoReadable(
        size
      )}, Speed: ${`${speedMBps.toFixed(2)} Mb/s`}, Time: ${`${duration.toFixed(2)} seconds`}`
    );

    return {
      size,
      buffer,
      contentType: response.headers["content-type"],
      name,
    };
  } catch (error) {
    console.log("Error while downloading file", error);
    throw error;
  }
}
export async function getOptimizedMedia(
  mediaRef,
  size,
  mimeType
): Promise<PublishMediaBuffer> {
  const fileName = `${mediaRef}/lossy-compression`;
  const file = getCloudBucketFile("optimized-post-media", fileName);

  return file.download().then(([buffer]) => {
    console.log(
      `✓ Downloaded optimized media, Size: ${formatBytesIntoReadable(size)}`,
      fileName
    );
    return {
      buffer,
      mimeType,
      type: getMediaTypeFromMimeType(mimeType),
      size,
      url: file.publicUrl(),
    };
  });
}

export async function getMediaFile(media: PublishMedia): Promise<PublishMediaBuffer> {
  return getMediaBuffer(media).then(({buffer, contentType, size, name}) => {
    const mimeType = media.mimeType || getMimeTypeFromContentType(contentType);
    return {
      buffer,
      contentType,
      mimeType,
      type: media.type || getMediaTypeFromMimeType(mimeType),
      size,
      url: media.url,
      ...(name && {name}),
    };
  });
}
export function getMimeTypeFromContentType(mt) {
  return mime.extension(mt) || null;
}
export function getMediaTypeFromMimeType(mt) {
  if (!mt) return null;
  if (imageMimeTypes.includes(mt)) return "image";
  else if (videoMimeTypes.includes(mt)) return "video";
  else if (docMimeTypes.includes(mt)) return "doc";
  else return null;
}
export function getMediaTypeFromContentType(ct) {
  const mt = getMimeTypeFromContentType(ct);
  return getMediaTypeFromMimeType(mt);
}
