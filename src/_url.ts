import {
  getContentTypeFromMimeType,
  getMediaTypeFromContentType,
  getMediaTypeFromMimeType,
  getMimeTypeFromContentType,
} from "./_media";
import {getBrowserHeaders, axiosWithRetry} from "./http";

export function isBase64String(str) {
  // Regular expression to match data URI with base64 encoding
  const base64Regex = /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-+.]+)?;base64,([a-zA-Z0-9+/]+={0,2})$/;

  return base64Regex.test(str);
}
export function removeAtSymbolFromUrls(inputParagraph) {
  // Define a regular expression to match the pattern: @http or @https
  const regex = /@https?:\/\//g;

  // Use the replace method to remove the "@" symbol from the start of each match
  const result = inputParagraph.replace(regex, "https://");

  return result;
}

export function getFileNameFromContentDisposition(contentDisposition) {
  if (!contentDisposition) return null;
  const regex = /filename="(.*?)"/;
  const match = contentDisposition.match(regex);

  if (match && match[1]) {
    return match[1];
  } else {
    return null; // No filename found
  }
}

export function convertToHttps(url: string) {
  if (!url || typeof url !== "string") return url;

  // Remove any leading/trailing whitespace
  url = url.trim();

  // If it starts with http://, convert to https://
  if (url.startsWith("http://")) {
    return url.replace(/^http:\/\//, "https://");
  }

  // If it starts with www. or doesn't have a protocol, add https://
  if (!url.startsWith("https://")) {
    return `https://${url.startsWith("www.") ? "" : ""}${url}`;
  }

  return url;
}
export function extractUrlFromString(text: string, removeUrl?: boolean): [string, string] {
  if (!text) return ["", ""];
  let _text = (" " + text).slice(1);

  const urlRegex =
    /(?<=\s|^)(https?:\/\/)?((www\.)?[a-zA-Z0-9-]+\.)+([a-zA-Z]{2,})(\/?[^\s]*[^\s.])?/gm;
  let firstUrl = "";

  const urlMatch = _text.match(urlRegex);
  if (urlMatch && urlMatch.length > 0) {
    firstUrl = urlMatch[0]?.trim();

    // Remove the URL in the text
    if (removeUrl) {
      _text = _text.replace(urlRegex, "");
    }
    _text = _text.trim();
  }

  return [_text, firstUrl];
}

export function extractUrlsFromString(inputString) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return inputString.match(urlRegex) || [];
}

export function extractTweetIdFromUrl(url) {
  if (!url) return null;
  const postIdMatch = url.match(/\/status\/(\d+)/);
  if (postIdMatch) {
    return postIdMatch[1]; // Extract {post-id}
  }
  return null; // If {post-id} is not found
}

export function isDescriptLink(inputURL: string): boolean {
  if (!inputURL) return false;
  const descriptRegex = /^https:\/\/share\.descript\.com\/view\/[a-zA-Z0-9]+\/?$/;
  return descriptRegex.test(inputURL);
}

export function isGiphyLink(inputURL: string): boolean {
  if (!inputURL) return false;
  const giphyRegex = /^https:\/\/(?:media\d*\.|i\.)?giphy\.com\//;
  return giphyRegex.test(inputURL);
}

export function alterGiphyLink(inputURL: string): string | null {
  if (!inputURL) return null;

  try {
    // If it's already a direct i.giphy.com URL, convert .webp to .gif if needed
    if (inputURL.startsWith("https://i.giphy.com/")) {
      return inputURL.replace(/\.webp$/, ".gif");
    }

    // Extract the Giphy ID from various Giphy URL formats
    // Handle complex media URLs with query parameters first (more specific)
    let giphyIdMatch = inputURL.match(/giphy\.com\/media\/[^\/]+\/([a-zA-Z0-9]+)(?:\/|$)/);

    if (!giphyIdMatch) {
      // Handle simple media URLs (only when there's no additional path)
      giphyIdMatch = inputURL.match(/giphy\.com\/media\/([a-zA-Z0-9]+)(?:\/|$)/);
    }

    if (!giphyIdMatch) {
      // Handle gifs URLs - the ID is the last part after the last hyphen
      const gifsMatch = inputURL.match(/giphy\.com\/gifs\/[^\/]+$/);
      if (gifsMatch) {
        const lastPart = gifsMatch[0].split("/").pop();
        const idMatch = lastPart.match(/([a-zA-Z0-9]+)$/);
        if (idMatch) {
          giphyIdMatch = [null, idMatch[1]];
        }
      }
    }

    if (giphyIdMatch && giphyIdMatch[1]) {
      const giphyId = giphyIdMatch[1];
      return `https://i.giphy.com/${giphyId}.gif`;
    }

    return null;
  } catch (error) {
    console.error("Error processing Giphy URL:", error);
    return null;
  }
}

/**
 * Extracts the file ID from various Google Drive URL formats
 * Supports:
 * - https://drive.google.com/file/d/{fileId}/view
 * - https://drive.google.com/file/d/{fileId}/edit
 * - https://drive.google.com/open?id={fileId}
 * - https://drive.google.com/uc?id={fileId}
 * - https://drive.google.com/uc?export=download&id={fileId}
 * - https://drive.usercontent.google.com/download?id={fileId}&confirm=xxx
 * - https://drive.google.com/document/d/{fileId}/edit
 * - https://docs.google.com/document/d/{fileId}/edit
 * - https://docs.google.com/spreadsheets/d/{fileId}/edit
 * - https://docs.google.com/presentation/d/{fileId}/edit
 * - https://www.googleapis.com/drive/v3/files/{fileId}?alt=media&key={apiKey}
 *
 * @param url - The Google Drive URL to parse
 * @returns The file ID if found, null otherwise
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url || typeof url !== "string") return null;

  // Pattern 1: /file/d/{fileId}/ or /document/d/{fileId}/ or /presentation/d/{fileId}/ or /spreadsheets/d/{fileId}/
  const pathPattern =
    /(?:drive|docs)\.google\.com\/(?:file|document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/;
  const pathMatch = url.match(pathPattern);
  if (pathMatch) return pathMatch[1];

  // Pattern 2: Google Drive API URL - googleapis.com/drive/v3/files/{fileId}
  const apiPattern = /googleapis\.com\/drive\/v3\/files\/([a-zA-Z0-9_-]+)/;
  const apiMatch = url.match(apiPattern);
  if (apiMatch) return apiMatch[1];

  // Pattern 3: ?id={fileId} or &id={fileId} (for open?id=, uc?id=, download?id= formats)
  const queryPattern = /[?&]id=([a-zA-Z0-9_-]+)/;
  const queryMatch = url.match(queryPattern);
  if (queryMatch) return queryMatch[1];

  return null;
}

/**
 * Helper function to create Google Drive API URL
 * Uses the Google Drive API v3 with API key authentication
 * This bypasses the malware scan warning page for large files
 */
export function getGdriveApiUrl(fileId: string): string | null {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return null;
  }
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
}

export function alterGDriveLink(inputURL) {
  if (!inputURL) return null;

  // Extract the file ID using the dedicated function
  const fileId = extractGoogleDriveFileId(inputURL);

  if (!fileId) {
    // If the input URL doesn't match any known Google Drive pattern
    return null;
  }

  // Prioritize API URL when API key is available
  const apiUrl = getGdriveApiUrl(fileId);

  if (apiUrl) {
    // Use API URL as primary download method
    return {
      name: fileId,
      url: apiUrl,
      downloadUrl: apiUrl,
    };
  } else {
    // Fall back to standard URLs when API key is not available
    console.warn(
      `GOOGLE_DRIVE_API_KEY not set. Using standard Google Drive URLs which may fail for large files (>25MB). Set the API key to avoid malware scan warnings.`
    );
    const alteredURL = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&confirm=xxx`;

    return {
      name: fileId,
      url: alteredURL,
      downloadUrl: downloadUrl,
    };
  }
}

export async function getGdriveContentHeaders(url: string): Promise<{
  contentType: string;
  contentLength: number;
  name: string;
  mimeType: string;
  mediaType?: "image" | "video" | "doc";
}> {
  if (!url) {
    throw new Error("URL is required");
  }

  // Extract file ID using the dedicated function
  const id = extractGoogleDriveFileId(url);

  if (!id) {
    throw new Error("Not a valid Google Drive URL - could not extract file ID");
  }

  const res = await axiosWithRetry({
    method: "GET",
    url: url,
    timeout: 30000,
    responseType: "stream",
    maxRedirects: 5,
    headers: getBrowserHeaders(),
    validateStatus: function (status) {
      return status >= 200 && status < 300; // default
    },
  });

  // Immediately abort the request after receiving headers
  res.data.destroy();

  const headers = res.headers;
  let contentType = headers["content-type"];
  const contentLength = Number(headers["content-length"]);
  const contentDisposition = headers["content-disposition"];

  // Handle simplified content types like "video" or "image"
  if (["video", "image"].includes(contentType?.toLowerCase())) {
    const contentTypeFromExt = getContentTypeFromMimeType(url?.split("?")[0]);
    if (contentTypeFromExt) {
      console.warn(
        `Fetched media header[content-type] type is wrong=${contentType}, So making it ${contentTypeFromExt}`
      );
      contentType = contentTypeFromExt;
    }
  }

  const mimeType = getMimeTypeFromContentType(contentType);
  const mediaType =
    getMediaTypeFromMimeType(mimeType) || getMediaTypeFromContentType(contentType);

  const err = !headers || !contentType || !mediaType;

  if (err) {
    throw new Error("Media file does not exist or is restricted.");
  }

  const name = getFileNameFromContentDisposition(contentDisposition);
  return {contentType, contentLength, name: id || name, mimeType, mediaType};
}
export async function getUrlContentHeaders(url: string): Promise<{
  contentType: string;
  contentLength: number;
  mimeType?: string;
  mediaType?: "image" | "video" | "doc";
  name?: string;
  url: string;
}> {
  if (!url) {
    throw new Error(`Not a valid url ${url}`);
  }

  const res = await axiosWithRetry({
    method: "GET",
    url: url,
    timeout: 30000,
    responseType: "stream",
    maxRedirects: 5,
    headers: getBrowserHeaders(),
    validateStatus: function (status) {
      return status >= 200 && status < 300; // default
    },
  });

  // Immediately abort the request after receiving headers
  res.data.destroy();

  const headers = res.headers;
  let contentType = headers["content-type"] || headers["Content-Type"];
  const contentLength = Number(headers["content-length"] || headers["Content-Length"]);
  const contentDisposition = headers["content-disposition"] || headers["Content-Disposition"];

  // Handle simplified content types like "video" or "image"
  if (["video", "image"].includes(contentType?.toLowerCase())) {
    const contentTypeFromExt = getContentTypeFromMimeType(url?.split("?")[0]);
    if (contentTypeFromExt) {
      console.warn(
        `Fetched media header[content-type] type is wrong=${contentType}, So making it ${contentTypeFromExt}`
      );
      contentType = contentTypeFromExt;
    }
  }

  const mimeType = getMimeTypeFromContentType(contentType);
  const mediaType =
    getMediaTypeFromMimeType(mimeType) || getMediaTypeFromContentType(contentType);

  let name = getFileNameFromContentDisposition(contentDisposition);
  if (!name) {
    const urlObj = new URL(url);
    name = urlObj.pathname.split("/").pop() || "unknown";
  }

  const err = !headers || !contentType || !mediaType;

  if (err) {
    throw new Error(`Cannot get media type for ${contentType}`);
  }

  return {contentType, contentLength, mimeType, mediaType, name, url};
}
