import {getMediaFromNotionBlock, getStaticMediaFromNotionBlock} from "./_media";
import {parseNotionBlockToText} from "./parser";
import {hasText, trimAndRemoveWhitespace, trimString} from "./text";
import TwitterText from "twitter-text";
const {parseTweet} = TwitterText;
import {
  BaseLinkedInPost,
  BaseTwitterPost,
  Content,
  FormattingOptions,
  PublishMedia,
  Thread,
  TwitterContent,
} from "types";
import {extractTweetIdFromUrl} from "./url";

export function convertBlocksToParagraphs(
  textArray: string[],
  mediaArray: PublishMedia[][]
): Thread[] {
  return textArray.map((text, index) => ({
    text,
    media: mediaArray[index] || [],
  }));
}

export function getContentFromNotionBlocksSync(blocks): Content & {hasMedia: boolean} {
  const limit = 63206;
  let rawContentArray = [];

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

  const [caption, textArray, mediaArray] = processRawContentBlocks(rawContentArray);

  mediaArray.forEach((mediaArr, index) => {
    const ht = hasText(textArray[index]);
    const hm = mediaArr?.length > 0;
    if (!ht && hm) {
      textArray[index] = "";
    }
  });

  const paragraphs = convertBlocksToParagraphs(textArray, mediaArray);
  const twitter = convertBlocksToTwitterThread(textArray, mediaArray);
  // const threads = convertTextToThreads(textArray, mediaArray);

  const content: Content & {hasMedia: boolean} = {
    text: caption,
    paragraphs,
    threads: [],
    twitter,
    hasMedia: paragraphs.some((p) => p.media?.length > 0),
  };

  return content;
}
export function processRawContentBlock(
  block,
  i,
  textArray,
  textArrayLast,
  mediaArray,
  mediaBuffer,
  rawContentArray
) {
  const isDivider = block == "---";
  const previewsOneWasDivider = rawContentArray[i - 1] == "---";
  if (isDivider) {
    if (previewsOneWasDivider) {
      block = "\n";
    } else if (textArrayLast.length > 0) {
      textArray.push(textArrayLast);
      mediaArray.push([...mediaBuffer]);
      mediaBuffer = [];
    }
    textArrayLast = "\n";
  } else if (typeof block == "object") {
    mediaBuffer.push(block);
  } else {
    textArrayLast = textArrayLast.concat(block);
    if (i < rawContentArray.length - 1 && rawContentArray[i + 1] != "---")
      textArrayLast = textArrayLast.concat(`\n`);
    if (i == rawContentArray.length - 1) {
      textArray.push(textArrayLast);
      mediaArray.push([...mediaBuffer]);
      mediaBuffer = [];
    }
  }
  return [textArrayLast, mediaBuffer];
}
export function processRawContentBlocks(
  rawContentArray
): [string, string[], PublishMedia[][]] {
  let mediaArray: PublishMedia[][] = [];
  let mediaBuffer: PublishMedia[] = [];
  let textArray: string[] = [];
  let textArrayLast = "";

  rawContentArray.forEach((rawBlock, i) => {
    const [_textArrayLast, _mediaBuffer] = processRawContentBlock(
      rawBlock,
      i,
      textArray,
      textArrayLast,
      mediaArray,
      mediaBuffer,
      rawContentArray
    );
    textArrayLast = _textArrayLast;
    mediaBuffer = _mediaBuffer;
  });
  textArray = textArray
    .map((s) => trimString(s))
    .filter((str, i) => {
      return str.length > 0;
    });
  const caption = textArray.join("\n").trim();

  return [caption, textArray, mediaArray];
}

export function convertBlocksToTwitterThread(
  textArray: string[],
  mediaArray: PublishMedia[][]
): TwitterContent {
  let threads: TwitterContent = [];
  textArray.forEach((str, index) => {
    const {tweets, quoteTweetId, replyToTweetId, retweetId} = tweetifyString(str);
    const firstTweet = tweets.splice(0, 1)[0];
    threads.push({
      text: firstTweet,
      media: mediaArray[index],
      quoteTweetId,
      replyToTweetId,
      retweetId,
    });
    tweets.forEach((t) => {
      const trimmedString = t.trim();
      threads.push({text: trimmedString, media: []});
    });
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
  return {tweets, quoteTweetId, replyToTweetId, retweetId};
}

export const TweetPostExtractRegex =
  /(https:\/\/(www\.)?(twitter\.com|x\.com)\/(i\/web\/status\/|status\/|\w+\/status\/)\d+\S*)/;

export function removeFirstTweetPostUrlFromText(text: string): string {
  return text.replace(TweetPostExtractRegex, "");
}

export function extractTwitterPostFromString(text: string): BaseTwitterPost {
  if (!text) return {text: "", quoteTweetId: null, replyToTweetId: null};

  const urlMatch = text.match(TweetPostExtractRegex);
  let quoteTweetId = null;
  let replyToTweetId = null;
  let retweetId = null;
  if (urlMatch) {
    const url = urlMatch[0];
    const tweetId = extractTweetIdFromUrl(url);
    const noText = !hasText(trimAndRemoveWhitespace(removeFirstTweetPostUrlFromText(text)));
    // Check if there is only the url, Which mean it is a retweet
    if (noText) {
      retweetId = tweetId;
      text = "";
    }
    const trimmedText = text.trim();
    // Check if the URL is at the beginning of the text
    if (trimmedText.startsWith(url)) {
      replyToTweetId = tweetId;
      text = removeFirstTweetPostUrlFromText(text);
    } else if (trimmedText.endsWith(url)) {
      // URL is at the end or middle, treat it as a reply
      quoteTweetId = tweetId;
      text = removeFirstTweetPostUrlFromText(text).trim();
    }
  }
  return {text, quoteTweetId, replyToTweetId, retweetId};
}

function processNotionBlockCommon(
  rawContentArray: any[],
  block,
  nextBlock,
  index: number,
  limit = 63206,
  media: PublishMedia | null,
  options?: FormattingOptions
): [number, number] {
  if (media) {
    rawContentArray.push(media);
  }

  let [text, _index] = parseNotionBlockToText(block, nextBlock, index, options);
  index = _index;

  const leftLimit = limit - rawContentArray.join("").length;

  if (text.length > leftLimit && text.length < 4) return [index, leftLimit];
  const str = text.substring(0, leftLimit);
  if (leftLimit > 0) {
    rawContentArray.push(str);
  }
  return [index, leftLimit];
}

export async function processNotionBlock(
  rawContentArray: any[],
  block,
  nextBlock,
  listIndex: number,
  limit = 63206,
  options?: FormattingOptions
) {
  const media = await getMediaFromNotionBlock(block);
  return processNotionBlockCommon(
    rawContentArray,
    block,
    nextBlock,
    listIndex,
    limit,
    media,
    options
  );
}

export function processStaticNotionBlock(
  rawContentArray: any[],
  block,
  nextBlock,
  listIndex: number,
  limit = 63206,
  options?: FormattingOptions
) {
  const media = getStaticMediaFromNotionBlock(block);
  return processNotionBlockCommon(
    rawContentArray,
    block,
    nextBlock,
    listIndex,
    limit,
    media,
    options
  );
}

export function getContentFromTextProperty(string, limit = 63206): Content {
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

  let texts = threadifyString(text);
  const threads = texts.map((text, index) => {
    return {text, media: []};
  });
  return {
    text,
    twitter,
    paragraphs: [{text, media: []}],
    threads,
  };
}
export function threadifyString(text, maxTweetLength = 500) {
  // text = replaceLineBreaksWithEmptySpaces(text);
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

export function convertTextToThreads(
  textArray: string[],
  mediaArray: PublishMedia[][]
): Thread[] {
  let __: Thread[] = [];
  textArray.forEach((str, index) => {
    const threads = threadifyString(str);
    const firstThread = threads.splice(0, 1)[0];
    __.push({text: firstThread, media: mediaArray[index]});
    threads.forEach((t) => {
      const trimmedString = t.trim();
      __.push({text: trimmedString, media: []});
    });
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

export function extractLinkedInPostFromString(text: string): BaseLinkedInPost {
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
