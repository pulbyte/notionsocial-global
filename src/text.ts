import {format as formatAxiosError} from "@redtea/format-axios-error";
import {RichTextItemResponse} from "@notionhq/client/build/src/api-endpoints";
import {SocialPlatformTypes} from "./types";
import TwitterText from "twitter-text";
import {isAxiosError} from "axios";
const {parseTweet} = TwitterText;
export function dashifyNotionId(input: string) {
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

export function matchIframe(htmlString: string) {
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

export function formatBytesIntoReadable(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  let l = 0,
    n = parseInt(bytes, 10) || 0;
  while (n >= 1024 && ++l) n = n / 1024;
  return n.toFixed(n < 10 && l > 0 ? 1 : 0) + " " + units[l];
}
export function getNotionDbId(link: string) {
  const arr = link.split("?")[0].split("/");
  return arr[arr.length - 1];
}
export function truncate(string: string = "", limit: number = 0) {
  return string.substring(0, limit);
}
export function getNotionBlockId(pagelink: string) {
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
    case "bluesky":
      return "BSKY";
    default:
      return String(platform).toUpperCase();
  }
}
export const getSmAccTag = (
  platform: SocialPlatformTypes,
  username: string,
  accType?: "page" | "group"
) => {
  const toIncluePage = platform == "linkedin" && accType == "page";
  const includeGroup = platform == "facebook" && accType == "group";
  return `${getSmShortName(platform)}${toIncluePage ? "-PAGE" : ""}${
    includeGroup ? "-GROUP" : ""
  }@${username}`;
};
export function notionRichTextParser(richTextArray: RichTextItemResponse[], trim?: boolean) {
  if (!richTextArray || !Array.isArray(richTextArray)) return "";
  return richTextArray
    .map((item) => {
      const str: string = item.plain_text || "";
      if (trim) return str.trim();
      return str;
    })
    .join("");
}

export function trimAndRemoveWhitespace(inputString: string): string {
  // Use a regular expression to match and remove whitespace characters
  if (!inputString) inputString = "";
  const trimmedString = inputString.replace(/\s/g, "");

  return trimmedString;
}
export function hasText(inputString: string | any) {
  if (!inputString) return false;
  if (typeof inputString !== "string") inputString = String(inputString);
  // Remove leading and trailing whitespace before checking
  inputString = inputString.trim();

  // Use a regular expression to check for non-whitespace characters
  return /\S/.test(inputString);
}

export function splitStrIntoChunks(str: string, size = 280) {
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
export function trimString(str: string, removeNewLines = true, trim = true): string {
  if (!str) return "";
  if (removeNewLines) str = str.replace(/^\n+|\n+$/g, ""); // remove \n from start and end
  if (trim) str = str.trim(); // trim whitespace
  return str;
}
export const urlRegexp =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?!&//=]*)/gi;

export function removeAtSymbol(text: string) {
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
export function hasNonJSCharacters(str: string) {
  const regex = /[^\x20-\x7E]/;
  return regex.test(str);
}
export function replaceLineBreaksWithEmptySpaces(inputString: string) {
  if (!inputString || typeof inputString !== "string") return "";

  // Split into words and line breaks
  const parts = inputString.split(/([^\n]+)/);

  return parts
    .map((part, index) => {
      // If it's a word, trim it
      if (part.trim().length > 0) {
        return part.trim();
      }

      // Count consecutive newlines
      const newlines = part.match(/\n/g)?.length || 0;
      if (newlines <= 2) return part;

      // Keep first and last \n untouched
      const middleNewlines = newlines - 2;
      const result = ["\n"]; // First newline

      // Create batches of newlines
      const batches = [];
      for (let i = 0; i < middleNewlines; i += 2) {
        const batch = i + 1 < middleNewlines ? "\n\n" : "\n";
        batches.push(batch);
      }
      // Process batches with spaces
      const processedBatches = batches.map((batch, i) => {
        if (i === 0) batch = ` ${batch}`;
        if (i === batches.length - 1) batch = `${batch} `;
        return batch;
      });

      result.push(processedBatches.join(" "));
      result.push("\n"); // Last newline
      return result.join("");
    })
    .join("");
}
export function checkTextExceedsTweetCharLimit(text: string) {
  return parseTweet(text).weightedLength > 280;
}
export function linkedinUrn(pid: string, accType: "page" | "group") {
  return accType == "page" ? `urn:li:organization:${pid}` : `urn:li:person:${pid}`;
}

export function logAxiosError(error, message = "Facebook graph api error") {
  if (isAxiosError(error)) {
    const formattedError = formatAxiosError(error);
    console.log(
      `${message ? "🛑 " + message + "\n" : ""}`,
      JSON.stringify(formattedError, null, 2)
    );
  } else if (error) {
    console.log(`${message ? "🛑 " + message + "\n" : ""}`, error);
  }
}
export function removeHyphens(inputString: string) {
  if (!inputString) return "";
  return inputString.replace(/-/g, "");
}
export function replaceCommasWithSpaces(inputString: string) {
  if (!inputString || typeof inputString !== "string") {
    console.log("inputString is invalid", inputString);
    return "";
  }
  // Use the replace method with a regular expression to replace all commas with spaces
  return inputString.replace(/,/g, " ");
}

export function extractTags(inputString: string) {
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
export function processInstagramTags(inputArray: string[]) {
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
        const usernamePattern = /^@?[a-zA-Z0-9._-]+$/; // Made @ optional with ?
        input = trimString(input);
        if (usernamePattern.test(input)) {
          // Remove @ if present
          return input.startsWith("@") ? input.substring(1) : input;
        } else {
          // Return null for invalid usernames
          return null;
        }
      }
    })
    .filter((username) => username !== null)
    .map((s) => s.toLowerCase());
}

export function sanitizePinterestBoardName(inputString: string) {
  if (!inputString || typeof inputString !== "string") return "";
  // Define a regular expression to match any prefix ending with @
  const regex = /^[^@]*@/;
  // Remove the matched prefix from the input string
  const result = inputString.replace(regex, "");
  return result;
}
export function snakeCaseToCamelCase(str: string) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}
export function camelCaseToSnakeCase(str: string) {
  return str.replace(/([A-Z])/g, (g) => `_${g[0].toLowerCase()}`);
}
export function numberToLetter(num: number): string {
  // Subtract 1 to make 1-based index into 0-based index
  num = num - 1;
  // Handle numbers greater than 26 by wrapping around
  const letterIndex = num % 26;
  // Convert to lowercase letter (97 is ASCII for 'a')
  return String.fromCharCode(97 + letterIndex);
}
export function numberToRoman(num: number): string {
  const romanNumerals = [
    {value: 1000, symbol: "M"},
    {value: 900, symbol: "CM"},
    {value: 500, symbol: "D"},
    {value: 400, symbol: "CD"},
    {value: 100, symbol: "C"},
    {value: 90, symbol: "XC"},
    {value: 50, symbol: "L"},
    {value: 40, symbol: "XL"},
    {value: 10, symbol: "X"},
    {value: 9, symbol: "IX"},
    {value: 5, symbol: "V"},
    {value: 4, symbol: "IV"},
    {value: 1, symbol: "I"},
  ];

  let result = "";

  // Convert number to roman numeral
  for (let i = 0; i < romanNumerals.length; i++) {
    while (num >= romanNumerals[i].value) {
      result += romanNumerals[i].symbol;
      num -= romanNumerals[i].value;
    }
  }

  return result.toLowerCase(); // Return lowercase for consistency
}
export function splitByEmDashes(text) {
  if (!text) return [];

  // Match two or more em dashes (—) or hyphens (-) with optional whitespace
  const regex = /\s*[—-]{2,}\s*/;

  // Split the text and filter out empty strings
  return text
    .split(regex)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
/**
 * Removes unsupported Unicode characters from a string
 *
 * @param {string} text - The input string to clean
 * @returns {string} - The cleaned string with unsupported characters removed
 *
 * @description
 * This function removes control characters and other potentially problematic
 * Unicode characters like directional formatting characters (U+202A - LRE,
 * U+202B - RLE, U+202C - PDF, U+202D - LRO, U+202E - RLO) and other invisible
 * characters that might cause issues in text processing or display.
 */
export function removeUnsupportedUnicodeChars(text: string): string {
  if (!text) return text;

  // Remove control characters (including directional formatting chars like U+202A)
  // U+0000 to U+001F: C0 control characters (except newlines U+000A)
  // U+007F: DEL
  // U+0080 to U+009F: C1 control characters
  // U+200B to U+200F: Zero width characters and directional marks
  // U+202A to U+202E: Directional formatting characters
  // U+2066 to U+2069: Directional isolate characters
  return text.replace(
    /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g,
    ""
  );
}

export function toScreamingSnakeCase(text: string): string {
  if (!text) return "";

  // Trim and normalize the string
  let result = text.trim();

  // Replace any existing camelCase with snake_case
  result = result.replace(/([a-z])([A-Z])/g, "$1_$2");

  // Replace spaces, hyphens, and multiple underscores with a single underscore
  result = result.replace(/[\s-]+/g, "_");
  result = result.replace(/_+/g, "_");

  // Remove any non-alphanumeric characters (except underscores)
  result = result.replace(/[^a-zA-Z0-9_]/g, "");

  // Convert to uppercase
  return result.toUpperCase();
}
