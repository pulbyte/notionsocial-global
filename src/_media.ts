import {docMimeTypes, imageMimeTypes, videoMimeTypes} from "./env";
import {
  ArrayElement,
  NotionFiles,
  Media,
  MediaFile,
  TransformedMedia,
  MediaType,
  PostMediaFile,
  PostMedia,
} from "./types";
import * as mime from "@alshdavid/mime-types";
import {dog} from "./logging";
import {notionRichTextParser, trimAndRemoveWhitespace} from "./text";
import {
  getUrlContentHeaders,
  getGdriveContentHeaders,
  isBase64String,
  alterGDriveLink,
  alterDescriptLink,
  isDescriptLink,
} from "./url";
import {SocialPlatformType} from "@pulbyte/social-stack-lib";

export function getMediaRef(url: string) {
  if (!url || typeof url != "string") return null;
  try {
    const {pathname} = new URL(url);
    const ref = trimAndRemoveWhitespace(
      decodeURIComponent(pathname).split("/").slice(-3).filter(Boolean).join("_")
    );
    // Replace non-ASCII characters with empty string
    return ref.replace(/[^\x20-\x7E]/g, "");
  } catch (error) {
    return null;
  }
}

export function packMedia(
  url: string,
  name: string,
  type: Media["type"],
  mimeType: string,
  contentType: string,
  refId: string,
  size?: number,
  description?: string
): Media {
  return {
    mimeType,
    url,
    name,
    refId,
    size,
    type,
    contentType,
    ...(description ? {description} : {}),
  };
}
export function filterPublishMedia(
  media: Media[],
  smAccPlatforms: SocialPlatformType[],
  mediaType?: Media["type"]
) {
  if (!media || !Array.isArray(media)) return [];

  let _ = media.filter((v) => !!v.type);

  // Filter by media type if specified
  if (mediaType) {
    _ = _.filter((m) => m.type === mediaType);
  }

  const docs = _.filter((m) => m.type == "doc");

  const singleSmAcc = smAccPlatforms.length == 1;
  const hasLinkedin = smAccPlatforms.includes("linkedin");
  const onlyLinkedIn = singleSmAcc && hasLinkedin;

  if (docs.length > 0) {
    // If there are docs, we need to check if the user is only posting to linkedin
    // if so, we need to limit the number of docs to 1
    // if not, we need to remove the docs from the media array
    if (onlyLinkedIn) _ = docs.slice(0, 1);
    else if (!hasLinkedin) {
      _ = _.filter((m) => m.type != "doc");
    }
    // Else we need to limit the number of media files to 35
    // Cause the max images for TikTok is 35, And all other platforms have lowser max for carousel
  } else _ = _.slice(0, 35);
  return _;
}
export function getContentTypeFromMimeType(mt: string): string | null {
  if (!mt) return null;
  const ct = mime.lookup(mt)?.[0];
  return ct || (mt === "video" ? "video/mp4" : mt === "image" ? "image/jpeg" : null);
}
export function getMimeTypeFromContentType(ct: string): string | null {
  if (!ct) return null;
  const mt = mime.extension(ct)?.[0];
  return mt || (ct === "video" ? "mp4" : ct === "image" ? "jpeg" : null);
}
export function getMediaTypeFromMimeType(mt: string): Media["type"] | null {
  if (!mt) return null;
  if (imageMimeTypes.includes(mt)) return "image";
  else if (videoMimeTypes.includes(mt)) return "video";
  else if (docMimeTypes.includes(mt)) return "doc";
  else return null;
}
export function getMediaTypeFromContentType(ct: string): Media["type"] | null {
  if (!ct) return null;
  if (ct?.includes("image")) return "image";
  else if (ct?.includes("video")) return "video";
  else if (ct?.includes("application")) return "doc";
  else {
    const mt = getMimeTypeFromContentType(ct);
    return getMediaTypeFromMimeType(mt);
  }
}

export const binaryUploadSocialPlatforms: SocialPlatformType[] = [
  "x",
  // Leave Twitter for backward compatibility
  "twitter",
  "linkedin",
  "youtube",
  "tiktok",
  "bluesky",
];
export const urlUploadSocialPlatforms: SocialPlatformType[] = [
  "facebook",
  "instagram",
  "pinterest",
  "threads",
];

export const mediaMimeTypes = imageMimeTypes.concat(videoMimeTypes).concat(docMimeTypes);

export function getMediaMimeType(file) {
  const split = file.split(".");
  let mimetype = split[split.length - 1];
  if (mimetype == "jpg") mimetype = "jpeg";
  return mimetype;
}

export function getMediaFromNotionBlock(block): Promise<Media | null> {
  const {type} = block;
  if (type == "image" || type == "video") {
    return getMediaFromNotionFile(block[type]);
  } else return Promise.resolve(null);
}

export function getNotionMediaName(str: string, mimeType?: string) {
  if (!str) return null;
  if (mimeType) {
    return str.split(`.${mimeType}`)[0];
  }
  return str;
}

export async function getMediaFromNotionFile(
  file: ArrayElement<NotionFiles>
): Promise<Media | null> {
  const extUrl = file?.["external"]?.["url"] as string;
  const gDriveMedia = alterGDriveLink(extUrl);

  const notionUrl = file?.["file"]?.url;
  const url = notionUrl || gDriveMedia?.url || extUrl;
  const isBase64 = isBase64String(url);
  if (!url || isBase64) return null;
  const mediaRef = getMediaRef(url);

  try {
    const urlData = new URL(url);

    // ? Notion files
    if (notionUrl) {
      const _pathSplit = urlData.pathname.split("/");
      const name = file?.name || _pathSplit[_pathSplit.length - 1];
      const description = notionRichTextParser(file?.["caption"]);
      const headers = await getUrlContentHeaders(notionUrl);
      const packed = packMedia(
        notionUrl,
        name,
        headers.mediaType,
        headers.mimeType,
        headers.contentType,
        mediaRef,
        headers.contentLength,
        description
      );
      return packed;
    }
    // ? Google Drive Files
    else if (gDriveMedia) {
      const headers = await getGdriveContentHeaders(gDriveMedia.downloadUrl);
      const packed = packMedia(
        gDriveMedia.downloadUrl,
        headers.name,
        headers.mediaType,
        headers.mimeType,
        headers.contentType,
        gDriveMedia.name,
        headers.contentLength
      );
      return packed;
    }
    // ? External URLs (including Descript)
    else if (extUrl) {
      dog("Fetching headers of an external URL", extUrl);
      let resolvedUrl = extUrl;
      if (isDescriptLink(extUrl)) {
        resolvedUrl = await alterDescriptLink(extUrl);
        dog("The external media is a descript url", resolvedUrl);
      }
      const headers = await getUrlContentHeaders(resolvedUrl);
      dog("Got the headers of the external URL", headers);
      if (headers.contentType && headers.contentLength) {
        const packed = packMedia(
          headers.url,
          headers.name,
          headers.mediaType,
          headers.mimeType,
          headers.contentType,
          mediaRef, // Using extUrl as mediaRef for external URLs
          headers.contentLength
        );
        return packed;
      } else {
        return null;
      }
    } else {
      return null;
    }
  } catch (e) {
    console.info("Error while fetching headers of a URL", url, e);
    return null;
  }
}

// ! TODO:- Add extUrl and gdriveUrl support here
// Common utility function
export function getNotionFileInfo(file) {
  const notionUrl = file?.["file"]?.url;
  if (!notionUrl || isBase64String(notionUrl)) return null;

  const {pathname} = new URL(notionUrl);
  const imgName = decodeURIComponent(pathname.slice(7));

  const name = file?.name || imgName.split("/").pop();
  const mediaRef = getMediaRef(notionUrl);
  const description = notionRichTextParser(file?.["caption"]);

  return {notionUrl, name, mediaRef, description};
}

export function getStaticMediaFromNotionFile(file: ArrayElement<NotionFiles>): Media | null {
  const fileInfo = getNotionFileInfo(file);

  if (!fileInfo) return null;

  const {notionUrl, name, mediaRef, description} = fileInfo;

  // Get mime type from file extension
  const mimeType = name.split(".").pop().toLowerCase();
  const contentType = getContentTypeFromMimeType(mimeType);
  const mediaType = getMediaTypeFromMimeType(mimeType);
  return packMedia(
    notionUrl,
    name,
    mediaType,
    mimeType,
    contentType,
    mediaRef,
    undefined,
    description
  );
}
export function getStaticMediaFromNotionBlock(block): Media | null {
  const {type} = block;
  if (type == "image" || type == "video") {
    return getStaticMediaFromNotionFile(block[type]);
  }
  return null;
}

export function makeMediaPostReady<T extends "file" | "media">(
  media: MediaType,
  platform?: SocialPlatformType
): T extends "file" ? PostMediaFile : PostMedia {
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
  const m: PostMediaFile = {
    // ? CONSTANT
    name: media.name,
    _id: media.refId,
    description: media.description,

    // ? CAN BE CHANGED DURING PROCESSING
    mimeType: media.mimeType,
    contentType: media.contentType,
    type: media.type,

    // ? DEFAULT UN-PROCESSED SRC
    metadata: {
      size: media.size,
      height: 0,
      width: 0,
    },
    url: media.url,
    ...((media as MediaFile).buffer && {buffer: (media as MediaFile).buffer}),
  };

  if ("transformations" in media && Array.isArray(media.transformations)) {
    const transformation = getTransformation(media.transformations);
    if (transformation) {
      const contentType = transformation.metadata?.contentType || m.contentType;
      const mimeType = getMimeTypeFromContentType(contentType) || m.mimeType;
      const type = getMediaTypeFromContentType(contentType) || m.type;

      const buffer = transformation.buffer || m.buffer;
      const url = transformation.url || m.url;

      const metadata = {
        ...transformation.metadata,
        size: transformation.metadata?.size || m.metadata.size,
      };

      const transformedMedia: PostMediaFile = {
        ...m,
        url,
        metadata,
        buffer,
        // In some transformations, the content type is changed
        // when we convert to a supprted mime type
        // Even the type can be changed, For example, pdf to jpg images
        contentType,
        mimeType,
        type,
      };
      return transformedMedia;
    }
  }
  return m;
}
