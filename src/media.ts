import _ from "lodash";
import {callFunctionsSequentially} from "./utils";
import {notionRichTextParser} from "./text";
import {
  ArrayElement,
  NotionFiles,
  NotionMediaFile,
  OptimizedMedia,
  PostRecord,
  PublishMedia,
  PublishMediaBuffer,
  SocialPostOptimizedMedia,
  SocialPostOptimizedMediaSrc,
} from "./types";
import {isBase64String, alterGDriveLink, getResourceContentHeaders} from "./url";

import {getCloudBucketFile} from "data";
import https from "https";
import {formatBytesIntoReadable} from "text";
import {getMediaType} from "parser";
import {docMimeTypes, imageMimeTypes, videoMimeTypes} from "env";

export const binaryUploadSocialPlatforms = ["twitter", "linkedin", "youtube", "tiktok"];
export const urlUploadSocialPlatforms = ["facebook", "instagram", "pinterest", "threads"];

export const mediaMimeTypes = imageMimeTypes.concat(videoMimeTypes).concat(docMimeTypes);

export function getMediaMimeType(file) {
  const split = file.split(".");
  let mimetype = split[split.length - 1];
  if (mimetype == "jpg") mimetype = "jpeg";
  return mimetype;
}

export function getPublishMediaFromNotionFile(
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
      const split = name.split(".");
      const mimeType = String(split[split.length - 1]).toLowerCase();
      const mediaRef = getNotionMediaRef(notionUrl);
      const packed = packMedia(notionUrl, name, mimeType, mediaRef);
      return resolve(packed);
    }
    // ? Google Drive Files
    else if (gDriveMedia) {
      const mediaRef = gDriveMedia.name;
      getResourceContentHeaders(gDriveMedia.downloadUrl)
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
  size?: number
): PublishMedia {
  if (mimeType == "quicktime") mimeType = "mov";
  const mediaType = getMediaType(mimeType);
  const obj = {mimeType, url, name: name, mediaRef, size};
  if (mediaType == "image") {
    return {...obj, type: "image"};
  } else if (mediaType == "video") {
    return {...obj, type: "video"};
  } else if (mediaType == "doc") {
    return {...obj, type: "doc"};
  } else return null;
}

export function updateMediaArrayFromNotionFiles(
  media: PublishMedia[],
  file: ArrayElement<NotionFiles>,
  index
) {
  return getPublishMediaFromNotionFile(file).then((__) => {
    if (__) media.splice(index, 0, __);
    return __;
  });
}
export const getMediaFromNotionFiles = (files: NotionFiles): Promise<PublishMedia[]> => {
  if (!files || files.length <= 0) {
    return Promise.resolve([]);
  } else {
    const media: PublishMedia[] = [];
    return callFunctionsSequentially(
      files.map((file, index) => {
        return () => updateMediaArrayFromNotionFiles(media, file, index);
      })
    ).then(() => {
      return media.filter((media) => media != null);
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
export function getMimeTypeExtensionFromContentType(cType) {
  const _specialTypes = {
    msword: "doc",
    "vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "vnd.ms-powerpoint": "ppt",
    "vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    quicktime: "mov",
  };
  const mimeType = String(cType).split("/")[1];
  return _specialTypes[mimeType] ? _specialTypes[mimeType] : mimeType;
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

const maxMediaSizeInMB = Number(process.env.MAX_MEDIA_SIZE_LIMIT_MB) || 200;
const maxMediaSizeInBytes = maxMediaSizeInMB * 1024 * 1024;
export function getMediaBuffer(media: PublishMedia): Promise<PublishMediaBuffer> {
  if (!media.url) {
    return Promise.reject(new Error("No URL provided to download media file."));
  }
  const {pathname} = new URL(media.url);
  const name = media.name || pathname;
  console.info("+ Downloading a media file: ", media);

  return new Promise((resolve: (arg0: any) => void, reject) => {
    const request = https
      .get(media.url, {timeout: 5 * 60000}, (res) => {
        res.setEncoding("binary");
        let data = Buffer.alloc(0);
        let progress = 0;
        res.on("data", (chunk) => {
          data = Buffer.concat([data, Buffer.from(chunk, "binary")]);
          const contentLength = Number(res.headers["content-length"]);
          if (contentLength > maxMediaSizeInBytes) {
            request.destroy(
              new Error(
                `${
                  media.type || "Media file"
                } exceeds ${maxMediaSizeInMB} MB size limit. Please reduce the file size by compressing or lowering quality, then upload again.`
              )
            );
            return;
          }
          const size = Buffer.byteLength(data);
          const newProgress = Math.trunc((100 * size) / contentLength);
          if (contentLength && size && progress < newProgress && newProgress % 20 == 0)
            console.info(`↓ Progress: ${newProgress}% ~ ↓${formatBytesIntoReadable(size)}`);
          progress = newProgress;
        });
        res.on("end", () => {
          const size = Buffer.byteLength(data) || res.headers["content-length"];

          resolve({buffer: data, contentType: res.headers["content-type"], size, name});
          console.info(
            `✓ Downloaded the media file, Size: ${formatBytesIntoReadable(size)}`,
            name
          );
        });
      })
      .on("timeout", () => {
        request.destroy(new Error(`✕ Media download timeout - ${name}`));
      })
      .on("error", (e) => {
        reject(e);
      });
  });
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
    return {buffer, mimeType, type: getMediaType(mimeType), size, url: file.publicUrl()};
  });
}

export async function getMediaFile(media: PublishMedia): Promise<PublishMediaBuffer> {
  return getMediaBuffer(media).then(({buffer, contentType, size, name}) => {
    const mimeType = getMimeTypeExtensionFromContentType(contentType);
    return {
      buffer,
      contentType,
      mimeType,
      type: getMediaType(mimeType),
      size,
      url: media.url,
      ...(name && {name}),
    };
  });
}
