import {Content} from "./types";
import {
  BlockObjectResponse,
  PartialBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {
  convertTextToThreads,
  convertBlocksToTwitterThread,
  processNotionBlock,
  processRawContentBlocks,
  convertBlocksToParagraphs,
} from "_content";
import {hasText} from "text";

type NotionBlocksIter = AsyncIterableIterator<
  PartialBlockObjectResponse | BlockObjectResponse
>;

export async function getContentFromNotionBlocksAsync(
  blocksIter: NotionBlocksIter
): Promise<Content & {hasMedia: boolean}> {
  const limit = 63206;
  let rawContentArray = [];

  let listIndex = 0;
  for await (const block of blocksIter) {
    listIndex = await processNotionBlock(rawContentArray, block, listIndex, limit);
  }
  const [caption, textArray, mediaArray] = processRawContentBlocks(rawContentArray);

  mediaArray.forEach((mediaArr, index) => {
    const ht = hasText(textArray[index]);
    const hm = mediaArr?.length > 0;
    if (!ht && hm) {
      textArray[index] = "";
    }
  });

  const twitter = convertBlocksToTwitterThread(textArray, mediaArray);
  const threads = convertTextToThreads(textArray, mediaArray);
  const paragraphs = convertBlocksToParagraphs(textArray, mediaArray);

  const content: Content & {hasMedia: boolean} = {
    text: caption,
    paragraphs,
    threads,
    twitter,
    hasMedia: paragraphs.some((p) => p.media?.length > 0),
  };

  return content;
}
