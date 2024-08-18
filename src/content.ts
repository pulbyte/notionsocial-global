import {
  checkTextExceedsTweetCharLimit,
  hasText,
  trimAndRemoveWhitespace,
  trimString,
} from "./text";
import {getMediaFromNotionBlock, parseNotionBlockToText} from "./parser";
import {BaseTwitterPost, Content, PublishMedia, Thread, TwitterContent} from "./types";
import TwitterText from "twitter-text";
const {parseTweet} = TwitterText;
import {
  BlockObjectResponse,
  PartialBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {extractTweetIdFromUrl} from "./url";

type NotionBlocksIter = AsyncIterableIterator<
  PartialBlockObjectResponse | BlockObjectResponse
>;
export function getContentFromTextProperty(string, limit = 63206): Content {
  const text = string.substring(0, limit);

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
    tweetExceededCharLimit: checkTextExceedsTweetCharLimit(string),
    twitter,
    paragraphs: [text],
    threads,
  };
}
export async function getContentFromNotionBlocksAsync(
  blocksIter: NotionBlocksIter
): Promise<Content> {
  const limit = 63206;
  let rawContentArray = [];

  let listIndex = 0;
  for await (const block of blocksIter) {
    listIndex = await processNotionBlock(rawContentArray, block, listIndex, limit);
  }
  const [caption, textArray, mediaArray] = processRawContentBlocks(rawContentArray);
  const twitter = convertTextToTwitterThread(textArray, mediaArray);
  const threads = convertTextToThreads(textArray, mediaArray);

  const content: Content = {
    text: caption,
    paragraphs: textArray,
    threads,
    tweetExceededCharLimit: textArray.some((text) => checkTextExceedsTweetCharLimit(text)),
    twitter,
  };

  return content;
}
export async function getContentFromNotionBlocksSync(blocks): Promise<Content> {
  const limit = 63206;
  let rawContentArray = [];

  let listIndex = 0;
  blocks.forEach(async (block) => {
    listIndex = await processNotionBlock(rawContentArray, block, listIndex, limit);
  });

  const [caption, textArray, mediaArray] = processRawContentBlocks(rawContentArray);
  const twitter = convertTextToTwitterThread(textArray, mediaArray);
  const threads = convertTextToThreads(textArray, mediaArray);

  const content: Content = {
    text: caption,
    paragraphs: textArray,
    threads,
    tweetExceededCharLimit: checkTextExceedsTweetCharLimit(caption),
    twitter,
  };

  return content;
}

async function processNotionBlock(rawContentArray, block, index: number, limit = 63206) {
  const media = await getMediaFromNotionBlock(block);
  if (media) {
    rawContentArray.push(media);
  }

  const isListItem = block.type == "numbered_list_item";
  const isBulletItem = block.type == "bulleted_list_item";
  if (index && !isListItem) index = 0;

  if (isListItem) index++;

  let finalStr = parseNotionBlockToText(block);

  if (finalStr && isListItem) finalStr = `${index}. ${finalStr}`;

  if (finalStr && isBulletItem) finalStr = `• ${finalStr}`;

  const leftLimit = limit - rawContentArray.join("").length;

  if (finalStr.length > leftLimit && finalStr.length < 4) return index;
  const str = finalStr.substring(0, leftLimit);
  if (leftLimit > 0) {
    rawContentArray.push(str);
  }
  return index;
}

function processRawContentBlock(
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
function processRawContentBlocks(rawContentArray): [string, string[], PublishMedia[][]] {
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
function convertTextToTwitterThread(textArray, mediaArray): TwitterContent {
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
    return hasText(obj.text) || hasText(obj.retweetId);
  });
  return threads;
}
function convertTextToThreads(textArray, mediaArray): Thread[] {
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
export function extractTwitterPostFromString(text: string): BaseTwitterPost {
  if (!text) return {text: "", quoteTweetId: null, replyToTweetId: null};

  const urlRegex =
    /(https:\/\/(www\.)?twitter\.com\/[^/]+\/status\/\d+\S*)|(https:\/\/(www\.)?x\.com\/[^/]+\/status\/\d+\S*)/;

  function replace(text) {
    return text.replace(urlRegex, "");
  }

  const urlMatch = text.match(urlRegex);
  let quoteTweetId = null;
  let replyToTweetId = null;
  let retweetId = null;
  if (urlMatch) {
    const url = urlMatch[0];
    const tweetId = extractTweetIdFromUrl(url);
    const noText = !hasText(trimAndRemoveWhitespace(replace(text)));
    // Check if there is only the url, Which mean it is a retweet
    if (noText) {
      retweetId = tweetId;
      text = "";
    }
    const trimmedText = text.trim();
    // Check if the URL is at the beginning of the text
    if (trimmedText.startsWith(url)) {
      replyToTweetId = tweetId;
      text = replace(text);
    } else if (trimmedText.endsWith(url)) {
      // URL is at the end or middle, treat it as a reply
      quoteTweetId = tweetId;
      text = replace(text).trim();
    }
  }
  return {text, quoteTweetId, replyToTweetId, retweetId};
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
