import axios from "axios";
import {
  getMediaTypeFromContentType,
  getMediaTypeFromMimeType,
  getMimeTypeFromContentType,
} from "./_media";
import urlMetadata from "url-metadata";

export function extractTweetIdFromUrl(url) {
  if (!url) return null;
  const postIdMatch = url.match(/\/status\/(\d+)/);
  if (postIdMatch) {
    return postIdMatch[1]; // Extract {post-id}
  }
  return null; // If {post-id} is not found
}
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

export function isDescriptLink(inputURL: string): boolean {
  if (!inputURL) return false;
  const descriptRegex = /^https:\/\/share\.descript\.com\/view\/[a-zA-Z0-9]+\/?$/;
  return descriptRegex.test(inputURL);
}
async function getDescriptVideoUrl(shareUrl: string) {
  const metadata = await urlMetadata(shareUrl);
  return metadata["descript:video"] as string;
}
export async function alterDescriptLink(inputURL: string) {
  try {
    const videoUrl = await getDescriptVideoUrl(inputURL);
    return videoUrl;
  } catch (error) {
    console.error("Error fetching Descript video URL:", error);
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

export function getGdriveContentHeaders(url): Promise<{
  contentType: string;
  contentLength: number;
  name: string;
  mimeType: string;
  mediaType?: "image" | "video" | "doc";
}> {
  let _url: URL;
  let id;
  try {
    _url = new URL(url);
    id = _url.searchParams.get("id");
  } catch (error) {
    return Promise.reject(new Error("Invalid URL"));
  }
  if (!url || !id) {
    return Promise.reject(new Error("Not a valid Google Drive url"));
  }

  return new Promise((resolve, reject) => {
    return axios
      .get(url, {
        method: "GET",
        timeout: 30000,
        responseType: "stream",
        maxRedirects: 5,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          DNT: "1",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Cache-Control": "max-age=0",
        },
        validateStatus: function (status) {
          return status >= 200 && status < 300; // default
        },
      })
      .then((res) => {
        // Immediately abort the request after receiving headers
        res.data.destroy();

        const headers = res.headers;
        const contentType = headers["content-type"];
        const contentLength = Number(headers["content-length"]);
        const contentDisposition = headers["content-disposition"];

        const mimeType = getMimeTypeFromContentType(contentType);
        const mediaType =
          getMediaTypeFromMimeType(mimeType) || getMediaTypeFromContentType(contentType);

        const err = !headers || !contentType || !mediaType;

        if (err) {
          reject(new Error("Media file does not exist or is restricted."));
        }

        const name = getFileNameFromContentDisposition(contentDisposition);
        resolve({contentType, contentLength, name: id || name, mimeType, mediaType});
      })
      .catch((error) => {
        console.error(`Error while fetching headers for ${url}:`, error);
        reject(error);
      });
  });
}
export function getUrlContentHeaders(url: string): Promise<{
  contentType: string;
  contentLength: number;
  mimeType?: string;
  mediaType?: "image" | "video" | "doc";
  name?: string;
  url: string;
}> {
  if (!url) {
    return Promise.reject(new Error(`Not a valid url ${url}`));
  }
  return new Promise((resolve, reject) => {
    return axios
      .get(url, {
        method: "GET",
        timeout: 30000,
        responseType: "stream",
        maxRedirects: 5,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          DNT: "1",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Cache-Control": "max-age=0",
        },
        validateStatus: function (status) {
          return status >= 200 && status < 300; // default
        },
      })
      .then((res) => {
        // Immediately abort the request after receiving headers
        res.data.destroy();

        const headers = res.headers;
        const contentType = headers["content-type"] || headers["Content-Type"];
        const contentLength = Number(headers["content-length"] || headers["Content-Length"]);
        const contentDisposition =
          headers["content-disposition"] || headers["Content-Disposition"];
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
          reject(new Error(`Cannot get media type for ${contentType}`));
        }
        resolve({contentType, contentLength, mimeType, mediaType, name, url});
      })
      .catch((error) => {
        console.error(`Error while fetching headers for ${url}:`, error);
        reject(error);
      });
  });
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
// Inside files, Cause it's a server function, And can't run in browser
export function getOGData(
  url: string
): Promise<{ogTitle: string; ogImage: string; ogSiteName: string}> {
  return urlMetadata(convertToHttps(url))
    .then((metadata) => {
      const _url = new URL(metadata.url);

      const ogTitle = metadata["title"] || metadata["og:title"] || metadata["twitter:title"];
      let ogImage =
        metadata["image"] ||
        metadata["og:image"] ||
        metadata["twitter:image"] ||
        metadata["imgTags"]?.find((_) => !!_.alt && !_.src?.startsWith("data:image"))?.["src"];
      if (ogImage?.startsWith("/")) ogImage = _url.origin + ogImage;
      const ogSiteName =
        metadata["og:site_name"] ||
        metadata["twitter:site"] ||
        metadata["jsonld"]?.[0]?.name ||
        _url.host ||
        url;

      const data = {
        ogTitle,
        ogImage,
        ogSiteName,
      };
      console.log("OG Data for", url, data);
      return data;
    })
    .catch((e) => {
      console.log(`Error in getting URL ${url} OG data`, e);
      throw e;
    });
}
