import _ from "lodash";
import {callFunctionsSequentially} from "./utils";
import {
  NotionFiles,
  MediaFile,
  Media,
  PostRecord,
  MediaTransformation,
  TransformedMedia,
} from "./types";

import {getCloudBucketFile} from "./data";
import {formatBytesIntoReadable} from "./text";
import {getMediaFromNotionFile, getMimeTypeFromContentType} from "./_media";
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
type DownloadedFile = Pick<MediaFile, "buffer" | "contentType" | "size" | "mimeType">;
export async function getMediaFile<T extends Media | string>(
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
        ...(typeof media === "object"
          ? media
          : {contentType, mimeType: getMimeTypeFromContentType(contentType)}),
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
