import twitterText from "twitter-text";
import {format as formatAxiosError} from "@redtea/format-axios-error";
import {RichTextItemResponse} from "@notionhq/client/build/src/api-endpoints";
import {NotionTitleProperty, SocialPlatformTypes} from "./types";
const {parseTweet} = twitterText;

export function dashifyNotionId(input) {
  if (typeof input !== "string") {
    return input;
  }

  if (input.includes("-")) return input;

  // Remove any existing dashes from the input string
  /* input = input.replace(/-/g, '') */

  // Define the positions where dashes should be inserted
  const dashPositions = [8, 12, 16, 20];

  // Initialize a result string
  let result = "";

  // Iterate over the input string and insert dashes
  for (let i = 0; i < input.length; i++) {
    result += input[i];

    if (dashPositions.includes(i + 1)) {
      result += "-";
    }
  }

  return result;
}

export function matchIframe(htmlString) {
  const iframeRegex = /<iframe\s+src=['"](https?:\/\/[^'"]+)['"][^>]*><\/iframe>/i;
  const match = htmlString.match(iframeRegex);
  return match;
}
export function extractIframeUrl(htmlString) {
  const match = matchIframe(htmlString);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

export function extractTweetUrlFromString(text) {
  let firstUrl = null;
  if (!text) return [firstUrl, text];

  const urlRegex =
    /(https:\/\/(www\.)?twitter\.com\/[^/]+\/status\/\d+\S*)|(https:\/\/(www\.)?x\.com\/[^/]+\/status\/\d+\S*)/;

  const urlMatch = text.match(urlRegex);
  if (urlMatch) {
    firstUrl = urlMatch[0];

    // Remove everything after the URL in the text
    text = text.replace(urlRegex, "");
    text = text.trim();
  }

  return [firstUrl, text];
}
export function threadifyString(text, maxTweetLength = 500) {
  const words = text.split(" ");
  const threads: string[] = [];
  let currentThread = "";
  for (const word of words) {
    const newTweet = currentThread + " " + word;
    if (newTweet.length > maxTweetLength) {
      threads.push(currentThread.trim());
      currentThread = word;
    } else {
      currentThread = newTweet.trim();
    }
  }
  threads.push(currentThread);
  return threads;
}
export function tweetifyString(text, maxTweetLength = 280) {
  const [url, satanizedText] = extractTweetUrlFromString(text);
  const words = satanizedText.split(" ");
  const tweets = [];
  let currentTweet = "";
  for (const word of words) {
    const newTweet = currentTweet + " " + word;
    if (parseTweet(newTweet).weightedLength > maxTweetLength) {
      tweets.push(currentTweet.trim());
      currentTweet = word;
    } else {
      currentTweet = newTweet.trim();
    }
  }
  tweets.push(currentTweet);
  return [tweets, url];
}
export function formatBytesIntoReadable(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  let l = 0,
    n = parseInt(bytes, 10) || 0;
  while (n >= 1024 && ++l) n = n / 1024;
  return n.toFixed(n < 10 && l > 0 ? 1 : 0) + " " + units[l];
}
export function getNotionDbId(link) {
  const arr = link.split("?")[0].split("/");
  return arr[arr.length - 1];
}
export function truncate(string = "", limit = 0) {
  return string.substring(0, limit);
}
export function getNotionBlockId(pagelink) {
  const pathArr = pagelink.split("/")[3].split("-");
  return pathArr[pathArr.length - 1];
}
export function getSmShortName(platform: SocialPlatformTypes) {
  switch (platform) {
    case "facebook":
      return "FB";
    case "instagram":
      return "IN";
    case "linkedin":
      return "LI";
    case "twitter":
      return "TW";
    case "youtube":
      return "YT";
    case "tiktok":
      return "TIKTOK";
    case "pinterest":
      return "PIN";
    case "threads":
      return "THREADS";
    default:
      return String(platform).toUpperCase();
  }
}
export const getSmAccTag = (platform, username, accType?: "page" | "group") => {
  const toIncluePage = platform == "linkedin" && accType == "page";
  const includeGroup = platform == "facebook" && accType == "group";
  return `${getSmShortName(platform)}${toIncluePage ? "-PAGE" : ""}${
    includeGroup ? "-GROUP" : ""
  }@${username}`;
};
export function notionRichTextParser(
  text: RichTextItemResponse | NotionTitleProperty,
  trim?: boolean
) {
  if (!text || typeof text != "object" || !Array.isArray(text)) return "";
  return text
    .map((obj) => {
      const str = String(obj.plain_text);
      if (trim) return str.trim();
      return str;
    })
    .join(" ");
}

export function trimAndRemoveWhitespace(inputString) {
  // Use a regular expression to match and remove whitespace characters
  if (!inputString) inputString = "";
  const trimmedString = inputString.replace(/\s/g, "");

  return trimmedString;
}
export function hasText(inputString) {
  if (!inputString) return false;
  if (typeof inputString !== "string") inputString = String(inputString);
  // Remove leading and trailing whitespace before checking
  inputString = inputString.trim();

  // Use a regular expression to check for non-whitespace characters
  return /\S/.test(inputString);
}

export function splitStrIntoChunks(str, size = 280) {
  const chunks = [];
  while (str.length > size) {
    const chunk = str.substring(0, size);
    chunks.push(chunk);
    str = str.substring(size);
  }
  if (str.length > 0) {
    chunks.push(str);
  }
  return chunks;
}
export function trimString(str): string {
  if (!str) return "";
  str = str.replace(/^\n+|\n+$/g, ""); // remove \n from start and end
  str = str.trim(); // trim whitespace
  return str;
}
export const urlRegexp =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?!&//=]*)/gi;

export function removeAtSymbol(text) {
  return String(text)
    .split(" ")
    .map((str) =>
      str
        .split("\n")
        .map((str) => (str.startsWith("@") ? str.split("@")[1] : str))
        .join("\n")
    )
    .join(" ");
}

export function getNameFromUrl(url) {
  const urlData = new URL(url);
  const _pathSplit = urlData.pathname.split("/");
  const name = _pathSplit[_pathSplit.length - 1];
  return decodeURIComponent(name);
}
export function extractLinkedInId(urnString) {
  const regex = /^urn:li:(\w+):(\d+)$/;
  const match = urnString.match(regex);

  if (match) {
    const type = match[1];
    const id = match[2];
    return {type, id};
  } else {
    // Handle invalid input or no match
    return null;
  }
}
export function hasNonJSCharacters(str) {
  const regex = /[^\x20-\x7E]/;
  return regex.test(str);
}
export function replaceLineBreaksWithEmptySpaces(inputString) {
  if (!inputString || typeof inputString != "string") return "";
  const lines = inputString.split("\n");

  // Initialize an empty array to store the processed lines
  const processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const last = lines[i + 1] == undefined;
    // If the current line is empty, push an empty string to processedLines
    const nextLineHasText = i < lines.length - 1 && lines[i + 1]?.trim() !== "";

    const lineEnding = last ? "" : nextLineHasText ? "\n" : "\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀";
    const line = lines[i]?.trim();
    processedLines.push(line + lineEnding);
  }

  // Join the processed lines with '\n'
  const result = processedLines.join("");

  return result;
}
export function checkTextExceedsTweetCharLimit(text) {
  return parseTweet(text).weightedLength > 280;
}
export function linkedinUrn(pid, accType) {
  return accType == "page" ? `urn:li:organization:${pid}` : `urn:li:person:${pid}`;
}

export function logAxiosError(error, message = "Facebook graph api error") {
  console.log(
    `${message ? "🛑 " + message + "\n" : ""}`,
    JSON.stringify(formatAxiosError(error), null, 2)
  );
}
export function removeHyphens(inputString: string) {
  if (!inputString) return "";
  return inputString.replace(/-/g, "");
}
export function replaceCommasWithSpaces(inputString) {
  if (!inputString) return "";
  // Use the replace method with a regular expression to replace all commas with spaces
  return inputString.replace(/,/g, " ");
}

export function extractTags(inputString) {
  if (!inputString || typeof inputString !== "string") return [];
  // Use a regular expression to find all @tags in the input string
  const tagPattern = /@(\w+)/g;
  const matches = inputString.match(tagPattern);

  // Extract and return the tag names
  if (matches) {
    const tagNames = matches.map((match) => match.substring(1));
    return tagNames;
  } else {
    return [];
  }
}

export function concatenateTextFromArray(array: any[], propertyName: string) {
  if (!array || !array.length) {
    return null;
  }
  return array.reduce((result, obj) => {
    // eslint-disable-next-line no-prototype-builtins
    if (obj && obj.hasOwnProperty(propertyName) && obj[propertyName] !== null) {
      return result + " " + obj[propertyName];
    }
    return result;
  }, "");
}
export function processInstagramTags(inputArray) {
  if (!inputArray) return [];
  return inputArray
    .map((input) => {
      if (!hasText(input)) return null;
      // Check if the input is an Instagram URL
      const urlPattern = /^https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9._-]+)\/?$/;
      const match = input.match(urlPattern);

      if (match) {
        // Extract and return the username from the URL
        return match[2];
      } else {
        // Validate if the input is a valid username (no spaces)
        const usernamePattern = /^[a-zA-Z0-9._-]+$/;
        input = trimString(input);
        if (usernamePattern.test(input)) {
          return input;
        } else {
          // Return null for invalid usernames
          return null;
        }
      }
    })
    .filter((username) => username !== null); // Filter out invalid usernames
}

export function sanitizePinterestBoardName(inputString) {
  if (!inputString || typeof inputString !== "string") return "";
  // Define a regular expression to match any prefix ending with @
  const regex = /^[^@]*@/;
  // Remove the matched prefix from the input string
  const result = inputString.replace(regex, "");
  return result;
}
export function snakeCaseToCamelCase(str) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}
export function camelCaseToSnakeCase(str) {
  return str.replace(/([A-Z])/g, (g) => `_${g[0].toLowerCase()}`);
}
