import _ from "lodash";
import {callFunctionsSequentially} from "./utils";
import {
  NotionFiles,
  TransformedMedia,
  ProcessedPostRecord,
  PublishMedia,
  PublishMediaBuffer,
  OptimizedPublishMedia,
} from "./types";

import {getCloudBucketFile} from "./data";
import {formatBytesIntoReadable} from "./text";
import {
  getMediaFromNotionFile,
  getMediaTypeFromMimeType,
  getMimeTypeFromContentType,
} from "_media";
import {downloadFromUrl} from "file";

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

export function getMediaTransformations(
  file: PublishMedia,
  postProcessedRecord?: ProcessedPostRecord
): TransformedMedia[] {
  if (!postProcessedRecord) return null;
  const optzed = _.find(postProcessedRecord?.media, {
    ref_id: file.refId,
  });
  return optzed?.transformations;
}

export function getMediaBuffer(media: PublishMedia) {
  if (!media.url) {
    return Promise.reject(new Error("No URL provided to download media file."));
  }
  const {pathname} = new URL(media.url);
  const name = media.name || pathname;
  console.info("+ Downloading a media file: ", media);

  return downloadFromUrl(media.url, name);
}

export async function getOptimizedMedia(media: PublishMedia): Promise<OptimizedPublishMedia> {
  const transformations = await Promise.all(
    media.transformations.map(async (asset) => {
      let buffer: Buffer;
      let url: string;
      const {src, metadata} = asset;

      switch (src.type) {
        case "bucket": {
          const file = getCloudBucketFile("optimized-post-media", src.path);
          buffer = await file.download()[0];
          url = file.publicUrl();
          console.log(
            `✓ Downloaded optimized media, Size: ${formatBytesIntoReadable(metadata.size)}`,
            src.path
          );
          break;
        }
        case "url": {
          ({buffer} = await downloadFromUrl(src.url));
          url = src.url;
          break;
        }
      }
      return {
        ...asset,
        src: {buffer, url},
      };
    })
  );
  return {
    ...media,
    transformations,
  };
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
