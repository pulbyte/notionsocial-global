import {hasText} from "./text";
import {Content, Thread, TwitterContent} from "./types";
import {
  BlockObjectResponse,
  PartialBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {
  convertTextToTwitterThread,
  processNotionBlock,
  processRawContentBlocks,
  tweetifyString,
} from "_content";

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
    twitter,
  };

  return content;
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
