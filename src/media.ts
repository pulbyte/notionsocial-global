import _ from "lodash";
import {callFunctionsSequentially} from "./utils";
import {
  NotionFiles,
  MediaFile,
  Media,
  PostRecord,
  MediaTransformation,
  MediaType,
  TransformedMedia,
  TMediaFile,
  TMedia,
  SocialPlatformTypes,
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

export const getMediaFromNotionFiles = (
  files: NotionFiles,
  altTextArr?: string[]
): Promise<Media[]> => {
  if (!files || files.length <= 0) {
    return Promise.resolve([]);
  } else {
    const mediaArr: Media[] = [];
    return callFunctionsSequentially(
      files.map(
        (file, index) => () =>
          getMediaFromNotionFile(file).then((media) => {
            if (media) {
              mediaArr.splice(
                index,
                0,
                Object.assign(media, {caption: altTextArr?.[index]?.trim() || ""})
              );
            }
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
): Promise<TransformedMedia> {
  const _ = await Promise.all(
    transformations.map(async (transformation: MediaTransformation) => {
      let buffer: Buffer;
      let url: string;
      const {src, metadata, compression, method, platforms} = transformation;

      switch (src.type) {
        case "bucket": {
          const file = getCloudBucketFile(ProcessedMediaBucket, src.path);
          if (toDownload) {
            [buffer] = await file.download();
            const [fileMetadata] = await file.getMetadata();
            const newContentType =
              fileMetadata?.contentType ||
              fileMetadata?.metadata?.contentType ||
              metadata.contentType;
            const newSize =
              fileMetadata?.size ||
              fileMetadata?.contentLength ||
              fileMetadata?.metadata?.size ||
              metadata.size;
            metadata.contentType = newContentType as string;
            metadata.size = parseInt(newSize as string);
          }
          url = file.publicUrl();
          break;
        }
        case "url": {
          if (toDownload) {
            const dwnFile = await downloadFromUrl(src.url);
            buffer = dwnFile.buffer;
            metadata.contentType = dwnFile.contentType;
            metadata.size = dwnFile.size;
          }
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
        compression,
        method,
        metadata,
        platforms,
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
  media: MediaType,
  platform?: SocialPlatformTypes
): T extends "file" ? TMediaFile : TMedia {
  // Helper function to extract the transformation based on platform
  const getTransformation = (transformations: TransformedMedia["transformations"]) => {
    // First, try to find a transformation that includes the specified platform
    if (platform) {
      const platformSpecific = transformations.find((t) => t.platforms?.includes(platform));
      if (platformSpecific) return platformSpecific;
    }

    // Then, look for a transformation with empty platforms array
    const defaultTransform = transformations.find(
      (t) => Array.isArray(t.platforms) && t.platforms.length === 0
    );
    if (defaultTransform) return defaultTransform;

    // Finally, fall back to the first transformation
    return transformations[0];
  };

  // Base media object
  const m: TMediaFile = {
    // ? CONSTANT
    name: media.name,
    refId: media.refId,
    caption: media.caption,

    // ? CAN BE CHANGED DURING PROCESSING
    mimeType: media.mimeType,
    contentType: media.contentType,
    type: media.type,

    // ? DEFAULT UN-PROCESSED SRC
    size: media.size,
    url: media.url,
    ...((media as MediaFile).buffer && {buffer: (media as MediaFile).buffer}),
    transformation: null,
  };

  if ("transformations" in media && Array.isArray(media.transformations)) {
    const transformation = getTransformation(media.transformations);
    if (transformation) {
      const ct = transformation.metadata?.contentType || m.contentType;
      const mt = getMimeTypeFromContentType(ct) || m.mimeType;

      const transformedMedia: TMediaFile = {
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
        transformation,
      };
      return transformedMedia;
    }
  }
  return m;
}
