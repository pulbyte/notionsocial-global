import axios from "axios";
import {
  getMediaTypeFromContentType,
  getMediaTypeFromMimeType,
  getMimeTypeFromContentType,
} from "_media";

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
export function removeAtSymbolFromLinks(inputParagraph) {
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

export function alterGDriveLink(inputURL) {
  if (!inputURL) return null;
  // Regular expression to match Google Drive file URL
  const driveRegex = /drive\.google\.com\/(?:file\/d\/|document\/d\/)([^\/\?]+)\/?/;

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

export function getGdriveContentHeaders(
  url
): Promise<{contentType: string; contentLength: number; name: string; mimeType: string}> {
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

        const mimeType = getMediaTypeFromContentType(contentType);
        const mediaType = getMediaTypeFromMimeType(mimeType);

        const err = !headers || !contentType || !mediaType;

        if (err) {
          reject(new Error("Media file does not exist or is restricted."));
        }

        const name = getFileNameFromContentDisposition(contentDisposition);
        resolve({contentType, contentLength, name: id || name, mimeType});
      })
      .catch((error) => {
        console.error(`Error while fetching headers for ${url}:`, error);
        reject(error);
      });
  });
}
export function getUrlContentHeaders(
  url
): Promise<{contentType: string; contentLength: number; mimeType?: string}> {
  if (!url) {
    return Promise.reject(new Error("Not a valid url"));
  }
  return new Promise((resolve, reject) => {
    return axios
      .get(url, {
        method: "GET",
        timeout: 10000,
        responseType: "stream",
        maxRedirects: 5,
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

        const mimeType = getMimeTypeFromContentType(contentType);
        const mediaType = getMediaTypeFromMimeType(mimeType);

        const err = !headers || !contentType || !mediaType;

        if (err) {
          reject(new Error(`Cannot get media type for ${url}`));
        }
        resolve({contentType, contentLength, mimeType});
      })
      .catch((error) => {
        console.error(`Error while fetching headers for ${url}:`, error);
        reject(error);
      });
  });
}
export function convertToHttps(url) {
  if (!url || typeof url !== "string") return url;
  // Check if the URL starts with "http://"
  if (url.startsWith("http://")) {
    // Replace "http://" with "https://"
    return url.replace(/^http:\/\//, "https://");
  }
  return url; // If it's already HTTPS or doesn't start with HTTP, return as-is
}
export function extractUrlFromString(text: string, removeUrl?: boolean): [string, string] {
  if (!text) return ["", ""];
  let _text = (" " + text).slice(1);

  const urlRegex =
    /(?<=\s|^)(https?:\/\/)?((www\.)?[a-zA-Z0-9-]+\.)+([a-zA-Z]{2,})([^\s]*)?/gm;
  let firstUrl = "";

  const urlMatch = _text.match(urlRegex);
  if (urlMatch && urlMatch.length > 0) {
    firstUrl = urlMatch[0]?.trim();

    // Remove everything after the URL in the text
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
