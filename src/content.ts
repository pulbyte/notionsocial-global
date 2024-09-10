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

type NotionBlocksIter = AsyncIterableIterator<
  PartialBlockObjectResponse | BlockObjectResponse
>;

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
  const twitter = convertBlocksToTwitterThread(textArray, mediaArray);
  const threads = convertTextToThreads(textArray, mediaArray);
  const paragraphs = convertBlocksToParagraphs(textArray, mediaArray);
  const content: Content = {
    text: caption,
    paragraphs,
    threads,
    twitter,
  };

  return content;
}
