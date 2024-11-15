import _ from "lodash";
import {callFunctionsSequentially} from "./utils";
import {
  NotionFiles,
  MediaFile,
  Media,
  PostRecord,
  MediaTransformation,
  MediaType,
  TMedia,
} from "./types";

import {getCloudBucketFile} from "./data";
import {formatBytesIntoReadable} from "./text";
import {
  getMediaFromNotionFile,
  getMediaTypeFromContentType,
  getMimeTypeFromContentType,
} from "./_media";
import {downloadFromUrl} from "./file";
import {ProcessedMediaBucket} from "./env";

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
type DownloadedFile = Partial<MediaFile> & {buffer: Buffer; contentType: string};
export function getMediaFile<T extends Media | string>(
  media: T
): Promise<T extends Media ? MediaFile : DownloadedFile> {
  const url = typeof media === "string" ? media : media.url;
  if (!url) {
    return Promise.reject(new Error("No URL provided to download media file."));
  }
  const {pathname} = new URL(url);
  const name = typeof media === "string" ? pathname : media.name;
  console.info("+ Downloading a media file: ", media);

  return downloadFromUrl(url, name).then(
    ({buffer, size, contentType}) =>
      ({
        ...(typeof media === "object" ? media : {contentType}),
        buffer,
        size,
      } as T extends Media ? MediaFile : DownloadedFile)
  );
}
export async function getTransformedMedia(
  media: Media,
  transformations: MediaTransformation[],
  toDownload: boolean = true
): Promise<TMedia> {
  const _ = await Promise.all(
    transformations.map(async (transformation: MediaTransformation) => {
      let buffer: Buffer;
      let url: string;
      const {src, metadata, orientation, compression, method} = transformation;

      switch (src.type) {
        case "bucket": {
          const file = getCloudBucketFile(ProcessedMediaBucket, src.path);
          if (toDownload) [buffer] = await file.download();
          url = file.publicUrl();
          break;
        }
        case "url": {
          if (toDownload) ({buffer} = await downloadFromUrl(src.url));
          url = src.url;
          break;
        }
      }
      if (toDownload) {
        console.log(
          `✓ Downloaded transformed media, Size: ${formatBytesIntoReadable(metadata.size)}`,
          src["path"] || src["url"]
        );
      }
      return {
        orientation,
        compression,
        method,
        metadata,
        ...(toDownload && {buffer}),
        url,
      };
    })
  );
  return {
    ...media,
    transformations: _,
  };
}

export function makeMediaPostReady<T extends "file" | "media">(
  media: MediaType | TMedia
): T extends "file" ? MediaFile : Media {
  // Helper function to extract the first transformation
  const getTransformation = (transformations: TMedia["transformations"]) => {
    // In the future, implement platform-specific logic here
    return transformations[0];
  };

  // Base media object
  const m: MediaFile = {
    // ? CONSTANT
    name: media.name,
    refId: media.refId,

    // ? CAN BE CHANGED DURING PROCESSING
    mimeType: media.mimeType,
    contentType: media.contentType,
    type: media.type,

    // ? DEFAULT UN-PROCESSED SRC
    size: media.size,
    url: media.url,
    buffer: (media as MediaFile).buffer,
  };

  // Handle TMedia and TMediaFile
  if ("transformations" in media && Array.isArray(media.transformations)) {
    const transformation = getTransformation(media.transformations);
    if (transformation) {
      const ct = transformation.metadata?.contentType || m.contentType;
      const mt = getMimeTypeFromContentType(ct) || m.mimeType;

      const transformedMedia = {
        ...m,
        url: transformation.url || m.url,
        size: transformation.metadata?.size || m.size,
        buffer: transformation.buffer || (m as MediaFile).buffer,
        // In some transformations, the content type is changed
        // when we convert to a supprted mime type
        // Even the type can be changed, For example, pdf to jpg images
        contentType: ct,
        mimeType: mt,
        type: getMediaTypeFromContentType(ct) || m.type,
      };
      return transformedMedia;
    }
  }
  // We don't want to return the buffer for Media
  if (!m.buffer) delete m.buffer;
  return m;
}
