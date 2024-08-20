import {getMediaFromNotionBlock, getStaticMediaFromNotionBlock} from "_media";
import {parseNotionBlockToText} from "parser";
import {
  checkTextExceedsTweetCharLimit,
  hasText,
  trimAndRemoveWhitespace,
  trimString,
} from "text";
import TwitterText from "twitter-text";
const {parseTweet} = TwitterText;
import {BaseTwitterPost, Content, PublishMedia, TwitterContent} from "types";
import {extractTweetIdFromUrl} from "./url";

export function getContentFromNotionBlocksSync(blocks): Content {
  const limit = 63206;
  let rawContentArray = [];

  let listIndex = 0;
  blocks.forEach((block) => {
    listIndex = processStaticNotionBlock(rawContentArray, block, listIndex, limit);
  });

  const [caption, textArray, mediaArray] = processRawContentBlocks(rawContentArray);
  const twitter = convertTextToTwitterThread(textArray, mediaArray);
  //   const threads = convertTextToThreads(textArray, mediaArray);

  const content: Content = {
    text: caption,
    paragraphs: textArray,
    threads: [],
    tweetExceededCharLimit: checkTextExceedsTweetCharLimit(caption),
    twitter,
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

export function convertTextToTwitterThread(textArray, mediaArray): TwitterContent {
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

export function extractTwitterPostFromString(text: string): BaseTwitterPost {
  if (!text) return {text: "", quoteTweetId: null, replyToTweetId: null};

  const urlRegex =
    /(https:\/\/(www\.)?(twitter\.com|x\.com)\/(i\/web\/status\/|status\/|\w+\/status\/)\d+\S*)/;

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

function processNotionBlockCommon(
  rawContentArray,
  block,
  index: number,
  limit = 63206,
  media: PublishMedia | null
) {
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

export async function processNotionBlock(
  rawContentArray,
  block,
  index: number,
  limit = 63206
) {
  const media = await getMediaFromNotionBlock(block);
  return processNotionBlockCommon(rawContentArray, block, index, limit, media);
}

export function processStaticNotionBlock(
  rawContentArray,
  block,
  index: number,
  limit = 63206
) {
  const media = getStaticMediaFromNotionBlock(block);
  return processNotionBlockCommon(rawContentArray, block, index, limit, media);
}
