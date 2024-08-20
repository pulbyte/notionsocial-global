import _ from "lodash";
import {callFunctionsSequentially} from "./utils";
import {
  NotionFiles,
  OptimizedMedia,
  PostRecord,
  PublishMedia,
  PublishMediaBuffer,
  SocialPostOptimizedMedia,
  SocialPostOptimizedMediaSrc,
} from "./types";

import {getCloudBucketFile} from "./data";
import {formatBytesIntoReadable} from "./text";
import {maxMediaSize} from "./env";
import axios from "axios";
import {
  getMediaFromNotionFile,
  getMediaTypeFromMimeType,
  getMimeTypeFromContentType,
} from "_media";

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
