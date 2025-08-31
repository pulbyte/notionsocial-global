import {
  getContentTypeFromMimeType,
  getMediaTypeFromContentType,
  getMediaTypeFromMimeType,
  getMimeTypeFromContentType,
} from "_media";
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

export function alterGDriveLink(inputURL) {
  if (!inputURL) return null;
  // Regular expression to match Google Drive file URL
  const driveRegex = /drive\.google\.com\/(?:file\/d\/|document\/d\/|open\?id=)([^\/\?&]+)/;

  // Check if the input URL matches the Google Drive file URL pattern
  const match = inputURL.match(driveRegex);

  if (match) {
    // Extract the file ID from the matched URL
    const fileId = match[1];

    // Construct the altered URL with the file ID
    const alteredURL = `https://drive.google.com/uc?export=download&id=${fileId}`;
    return {
      name: fileId,
      url: alteredURL,
      downloadUrl: `https://drive.usercontent.google.com/download?id=${fileId}&confirm=xxx`,
    };
  } else {
    // If the input URL doesn't match the pattern, return null or handle accordingly
    return null;
  }
}

export async function getGdriveContentHeaders(url: string): Promise<{
  contentType: string;
  contentLength: number;
  name: string;
  mimeType: string;
  mediaType?: "image" | "video" | "doc";
}> {
  let _url: URL;
  let id: string;
  try {
    _url = new URL(url);
    id = _url.searchParams.get("id");
  } catch (error) {
    throw new Error("Invalid URL");
  }
  if (!url || !id) {
    throw new Error("Not a valid Google Drive url");
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
