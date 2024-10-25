import _ from "lodash";
import {callFunctionsSequentially} from "./utils";
import {
  NotionFiles,
  MediaFile,
  Media,
  PostRecord,
  TMedia,
  MediaTransformation,
  TMediaFile,
} from "./types";

import {getCloudBucketFile} from "./data";
import {formatBytesIntoReadable} from "./text";
import {
  getMediaFromNotionFile,
  getMediaTypeFromMimeType,
  getMimeTypeFromContentType,
} from "_media";
import {downloadFromUrl} from "file";

export const getMediaFromNotionFiles = (files: NotionFiles): Promise<Media[]> => {
  if (!files || files.length <= 0) {
    return Promise.resolve([]);
  } else {
    const mediaArr: Media[] = [];
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
  file: Media,
  processedMedia?: PostRecord["processed_media"]
): MediaTransformation[] {
  if (!processedMedia) return null;
  const optzed = _.find(processedMedia, {
    ref_id: file.refId,
  });
  return optzed?.transformations;
}

export function getMediaBuffer(media: Media) {
  if (!media.url) {
    return Promise.reject(new Error("No URL provided to download media file."));
  }
  const {pathname} = new URL(media.url);
  const name = media.name || pathname;
  console.info("+ Downloading a media file: ", media);

  return downloadFromUrl(media.url, name).then(({buffer, contentType, size}) =>
    Object.assign(media, {buffer, contentType, size})
  );
}

export async function getTransformedMediaFile(
  media: Media,
  transformations: MediaTransformation[]
): Promise<TMediaFile> {
  const _: TMediaFile["transformations"] = await Promise.all(
    transformations.map(async (transformation: MediaTransformation) => {
      let buffer: Buffer;
      let url: string;
      const {src, metadata} = transformation;

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
        ...transformation,
        buffer,
        url,
      };
    })
  );
  return {
    ...media,
    transformations: _,
  };
}

export async function getMediaFile(media: Media): Promise<MediaFile> {
  return getMediaBuffer(media).then((_) => {
    const mimeType = media.mimeType || getMimeTypeFromContentType(_.contentType);
    return {
      ..._,
      type: media.type || getMediaTypeFromMimeType(mimeType),
      ...(media.name && {name: media.name}),
    };
  });
}
