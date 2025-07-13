import {extractTags, hasText, trimAndRemoveWhitespace} from "./text";
import TwitterText from "twitter-text";
const {parseTweet} = TwitterText;
import {BaseLinkedInPost, BaseTweet, Paragraph, PostMediaFile, Thread, XContent} from "types";
import {extractTweetIdFromUrl} from "./url";

export function convertSectionsToParagraphs(
  textArray: string[],
  mediaArray: Media[][]
): Thread[] {
  return textArray.map((text, index) => ({
    text,
    media: mediaArray[index] || [],
  }));
}

export function getContentFromNotionBlocksSync(blocks): Content & {hasMedia: boolean} {
  const limit = 63206;
  let rawContentArray: ParsedNotionBlock[] = [];

  let listIndex = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const nextBlock = blocks[i + 1];
    // if (!SUPPORTED_NOTION_CONTENT_BLOCKS?.includes(block["type"])) break;
    const [_listIndex, _limitLeft] = processStaticNotionBlock(
      rawContentArray,
      block,
      nextBlock,
      listIndex,
      limit
    );
    listIndex = _listIndex;
    if (!_limitLeft) break;
  }

  const [caption, textArray, mediaArray] = processParsedNotionBlocks(rawContentArray);

  mediaArray.forEach((mediaArr, index) => {
    const ht = hasText(textArray[index]);
    const hm = mediaArr?.length > 0;
    if (!ht && hm) {
      textArray[index] = "";
    }
  });

  const paragraphs = convertSectionsToParagraphs(textArray, mediaArray);
  const twitter = convertSectionsToTwitterThread(textArray, mediaArray);
  // const threads = convertTextToThreads(textArray, mediaArray);

  const content: Content & {hasMedia: boolean} = {
    text: caption,
    paragraphs,
    threads: [],
    twitter,
    bluesky: [],
    hasMedia: paragraphs.some((p) => p.media?.length > 0),
  };

  return content;
}
export function processParsedNotionBlock(
  parsed: ParsedNotionBlock,
  i: number,
  textSections: string[],
  textBuffer: string,
  mediaSections: Media[][],
  mediaBuffer: Media[],
  parsedBlocks: ParsedNotionBlock[]
): [string, Media[]] {
  //@ts-ignore
  let text = parsed.content || "";
  const isDivider = parsed.type == "divider";
  const previewsOneWasDivider = parsedBlocks[i - 1]?.type == "divider";
  const nextOne = parsedBlocks[i + 1];
  const nextOneIsText = nextOne?.type == "text";
  if (isDivider) {
    if (textBuffer.length && !previewsOneWasDivider) {
      textSections.push(textBuffer);
      mediaSections.push([...mediaBuffer]);
      mediaBuffer = [];
      textBuffer = "";
    }
  } else if (parsed.type == "media") {
    mediaBuffer.push(parsed.media);
  } else {
    textBuffer = textBuffer + text;
    if (nextOneIsText) textBuffer = textBuffer + `\n`;
    if (i == parsedBlocks.length - 1) {
      textSections.push(textBuffer);
      mediaSections.push([...mediaBuffer]);
      mediaBuffer = [];
    }
  }
  return [textBuffer, mediaBuffer];
}
export function processParsedNotionBlocks(
  parsedBlocks: ParsedNotionBlock[]
): [string, string[], Media[][]] {
  let mediaSections: Media[][] = [];
  let mediaBuffer: Media[] = [];
  let textSections: string[] = [];
  let textBuffer = "";

  parsedBlocks.forEach((parsed, i) => {
    const [_textBuffer, _mediaBuffer] = processParsedNotionBlock(
      parsed,
      i,
      textSections,
      textBuffer,
      mediaSections,
      mediaBuffer,
      parsedBlocks
    );
    textBuffer = _textBuffer;
    mediaBuffer = _mediaBuffer;
  });
  textSections = textSections.map((s) => trimString(s)).filter((s) => s.length > 0);
  const caption = textSections.join("\n\n");

  return [caption, textSections, mediaSections];
}

export function convertSectionsToTwitterThread(
  sections: string[],
  mediaArray: Media[][]
): TwitterContent {
  let threads: TwitterContent = [];
  sections.forEach((str, index) => {
    const {tweets, quoteTweetId, replyToTweetId, retweetId} = tweetifyString(str, 280);
    const firstTweet = tweets.splice(0, 1)[0];
    threads.push({
      text: firstTweet,
      media: mediaArray[index],
      quoteTweetId,
      replyToTweetId,
      retweetId,
    });
    tweets.forEach((text) => threads.push({text, media: []}));
  });
  threads = threads.filter((obj) => {
    return hasText(obj.text) || hasText(obj.retweetId) || !!obj.media?.length;
  });
  return threads;
}

export function tweetifyString(text, maxTweetLength = 280) {
  const {
    text: sanitizedText,
    quoteTweetId,
    replyToTweetId,
    retweetId,
  } = extractTwitterPostFromString(text);
  const words = sanitizedText.split(" ");
  const tweets = [];
  let currentTweet = words[0] || ""; // Start with first word

  // Start loop from second word
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const newTweet = currentTweet + " " + word;
    if (parseTweet(newTweet).weightedLength > maxTweetLength) {
      tweets.push(currentTweet);
      currentTweet = word;
    } else {
      currentTweet = newTweet;
    }
  }
  tweets.push(currentTweet);
  return {tweets, quoteTweetId, replyToTweetId, retweetId};
}

export const TweetPostExtractRegex =
  /(https:\/\/(www\.)?(twitter\.com|x\.com)\/(i\/web\/status\/|status\/|\w+\/status\/)\d+\S*)/;

export function removeFirstTweetPostUrlFromText(text: string): string {
  return text.replace(TweetPostExtractRegex, "");
}

export function parseTextForXPost(text: string): BaseTweet {
  const __: BaseTweet = {text: ""};
  if (!text) return __;

  const urlMatch = text.match(TweetPostExtractRegex);

  if (urlMatch) {
    const url = urlMatch[0];
    const tweetId = extractTweetIdFromUrl(url);
    const noText = !hasText(trimAndRemoveWhitespace(removeFirstTweetPostUrlFromText(text)));
    // Check if there is only the url, Which mean it is a retweet
    if (noText) {
      __.repostId = tweetId;
      text = "";
    }
    const trimmedText = text.trim();
    // Check if the URL is at the beginning of the text
    if (trimmedText.startsWith(url)) {
      __.replyToPostId = tweetId;
      text = removeFirstTweetPostUrlFromText(text);
    } else if (trimmedText.endsWith(url)) {
      // URL is at the end or middle, treat it as a reply
      __.quotePostId = tweetId;
      text = removeFirstTweetPostUrlFromText(text).trim();
    }
  }
  return {text, quoteTweetId, replyToTweetId, retweetId};
}

function processNotionBlockCommon(
  parsedBlocks: ParsedNotionBlock[],
  block: NotionBlock,
  nextBlock: NotionBlock,
  listIndex: number,
  limit = 63206,
  media: Media | null,
  options?: FormattingOptions
): [number, number] {
  if (media) {
    parsedBlocks.push({type: "media", media});
  }

  let nestIndex = 1;
  let [result, _listIndex, _nestIndex] = parseNotionBlockToText(
    block,
    nextBlock,
    listIndex,
    nestIndex,
    options
  );

  listIndex = _listIndex;
  nestIndex = _nestIndex;
  const currentLength = parsedBlocks.join("").length;
  const leftLimit = limit - currentLength;

  // ?  Only push limited text
  if (result.type == "text") {
    const text = result.content || "";
    if (text.length > leftLimit && text.length < 4) {
      console.warn("Terminating early - text too long but < 4 chars", {
        "text.length": text.length,
        leftLimit,
        limit,
        currentLength,
      });
    } else if (leftLimit > 0) {
      parsedBlocks.push({type: "text", content: text.substring(0, leftLimit)});
    } else {
      console.warn("! Skipping text - character limit exceeded");
    }
  } else {
    parsedBlocks.push(result);
  }
  return [listIndex, leftLimit];
}

export async function processNotionBlock(
  parsedNotionBlocks: ParsedNotionBlock[],
  block: NotionBlock,
  nextBlock: NotionBlock,
  listIndex: number,
  limit: number,
  options?: FormattingOptions
) {
  const media = await getMediaFromNotionBlock(block);
  return processNotionBlockCommon(
    parsedNotionBlocks,
    block,
    nextBlock,
    listIndex,
    limit,
    media,
    options
  );
}

export function processStaticNotionBlock(
  parsedNotionBlocks: ParsedNotionBlock[],
  block: NotionBlock,
  nextBlock: NotionBlock,
  listIndex: number,
  limit: number,
  options?: FormattingOptions
) {
  const media = getStaticMediaFromNotionBlock(block);
  return processNotionBlockCommon(
    parsedNotionBlocks,
    block,
    nextBlock,
    listIndex,
    limit,
    media,
    options
  );
}

export function getContentFromTextProperty(string: string, limit = 63206): Content {
  const text: string = string.substring(0, limit);
  const twitter: TwitterContent = [];
  const {tweets, quoteTweetId, replyToTweetId, retweetId} = tweetifyString(text);
  tweets.forEach((tweet, index) => {
    twitter.push({
      text: tweet,
      media: [],
      ...((index == 0 && retweetId && {retweetId}) ||
        (quoteTweetId && {quoteTweetId}) ||
        (replyToTweetId && {replyToTweetId})),
    });
  });

  let threadTexts = threadifyString(text, 500, "twitter-text");
  const threads = threadTexts.map((text, index) => {
    return {text, media: []};
  });
  let blueskyTexts = threadifyString(text, 300, "string");
  const bluesky = blueskyTexts.map((text, index) => {
    return {text, media: []};
  });
  return {
    text,
    twitter,
    paragraphs: [{text, media: []}],
    threads,
    bluesky,
  };
}
export function threadifyString(
  text: string,
  maxTextLength: number,
  lengthMethod: "twitter-text" | "string"
) {
  const words = text.split(" ");
  const threads: string[] = [];
  let currentThread = words[0] || ""; // Start with first word

  // Start loop from second word
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const newThread = currentThread + " " + word;
    const exceedsLength =
      lengthMethod === "twitter-text"
        ? parseTweet(newThread).weightedLength > maxTextLength
        : newThread.length > maxTextLength;

    if (exceedsLength) {
      threads.push(currentThread);
      currentThread = word;
    } else {
      currentThread = newThread;
    }
  }
  threads.push(currentThread);
  return threads;
}

export function convertTextToThreads(
  textArray: string[],
  mediaArray: Media[][],
  maxTextLength: number,
  lengthMethod: "twitter-text" | "string"
): Thread[] {
  let __: Thread[] = [];
  textArray.forEach((str, index) => {
    const threads = threadifyString(str, maxTextLength, lengthMethod);
    const firstThread = threads.splice(0, 1)[0];
    __.push({text: firstThread, media: mediaArray[index]});
    threads.forEach((text) => __.push({text, media: []}));
  });
  __ = __.filter((obj) => {
    return hasText(obj.text) || obj.media?.length > 0;
  });
  return __;
}

export const LinkedInPostExtractRegex =
  /(https:\/\/(www\.)?linkedin\.com\/embed\/feed\/update\/(urn:li:(share|ugcPost):\d+))/;

export function removeFirstLinkedInPostUrlFromText(text: string): string {
  return text.replace(LinkedInPostExtractRegex, "");
}

export function parseTextForLinkedInPost(text: string): BaseLinkedInPost {
  if (!text) return {text: "", quotePostId: null, replyToPostId: null, repostId: null};

  const urlMatch = text.match(LinkedInPostExtractRegex);
  let quotePostId = null;
  let replyToPostId = null;
  let repostId = null;

  if (urlMatch) {
    const url = urlMatch[0];
    const postId = urlMatch[3];
    const noText = !hasText(trimAndRemoveWhitespace(removeFirstLinkedInPostUrlFromText(text)));
    if (noText) {
      repostId = postId;
      text = "";
    } else {
      const trimmedText = trimAndRemoveWhitespace(text);
      if (trimmedText.startsWith(url)) {
        replyToPostId = postId;
        // Remove the URL and any following newline character
        text = text.replace(new RegExp(`${url}\\s*\\n?`), "").trim();
      } else {
        quotePostId = postId;
        text = removeFirstLinkedInPostUrlFromText(text).trim();
      }
    }
  }

  return {text, quotePostId, replyToPostId, repostId};
}
