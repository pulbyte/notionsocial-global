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
import axios from "axios";
import {mediaFromLink, type LinkDeps} from "./media-links";

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
                Object.assign<Media, Partial<Media>>(media, {
                  description: altTextArr?.[index]?.trim() || "",
                })
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

// #65: a GET that never throws on status; redirects followed, body as text.
const httpGet: LinkDeps<Media>["get"] = async (url) => {
  const res = await axios.get(url, {
    timeout: 30000,
    maxRedirects: 5,
    responseType: "text",
    transformResponse: (d) => d,
    validateStatus: () => true,
    headers: {"User-Agent": "Mozilla/5.0 (compatible; NotionSocial/1.0; +https://notionsocial.app)"},
  });
  return {status: res.status, body: String(res.data ?? ""), url: res.request?.res?.responseUrl || url};
};

const linkDeps: LinkDeps<Media> = {
  get: httpGet,
  fromUrl: (url) => getMediaFromNotionFile({type: "external", name: url, external: {url}} as any),
  driveApiKey: process.env.GOOGLE_DRIVE_API_KEY,
};

// The media a pasted link stands for (Drive folder, Canva design, Drive or direct file link).
export const getMediaFromLink = (url: string) => mediaFromLink(url, linkDeps);

/**
 * #65 (config/cutover."media-extraction"): like getMediaFromNotionFiles, but a pasted link can
 * give several files (a Drive folder) and Drive or Canva links that give none throw the catalogue
 * error instead of being dropped. Files keep the order of the property.
 */
export async function getLinkedMediaFromNotionFiles(
  files: NotionFiles,
  altTextArr?: string[]
): Promise<Media[]> {
  const out: Media[] = [];
  for (const [index, file] of (files || []).entries()) {
    const extUrl = file?.["external"]?.["url"] as string | undefined;
    const media = extUrl ? await getMediaFromLink(extUrl) : [await getMediaFromNotionFile(file)];
    const found = media.filter(Boolean);
    const description = found.length == 1 ? altTextArr?.[index]?.trim() || "" : "";
    for (const m of found) out.push(Object.assign(m, {description}));
  }
  return out;
}

export function getMediaTransformations(
  file: Media,
  processedMedia?: PostRecord["processed_media"]
): MediaTransformation[] {
  if (!processedMedia) return [];
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
        case "buffer": {
          if (toDownload) {
            buffer = src.buffer;
          }
          url = ""; // Buffer sources don't have URLs
          break;
        }
        case "bucket": {
          const file = getCloudBucketFile(ProcessedMediaBucket, src.path);
          if (toDownload) {
            const [downloadBuffer] = await file.download();
            buffer = downloadBuffer;
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
