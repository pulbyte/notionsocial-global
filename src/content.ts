import {Content, FormattingOptions} from "./types";
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
import {callFunctionsSequentially} from "utils";

type Block = PartialBlockObjectResponse | BlockObjectResponse;
type NotionBlocksIter = AsyncIterableIterator<Block>;

export async function getContentFromNotionBlocksAsync(
  blocksIter: NotionBlocksIter,
  options?: FormattingOptions
): Promise<Content & {hasMedia: boolean}> {
  const limit = 10000;
  let rawContentArray = [];

  // Needed for list-item blocks
  let listIndex = 0;
  // hard copy the limit

  let limitLeft = limit;

  // We will first push the blocks to a batch of 3 and then process them
  let batch: Block[] = [];

  async function blockProcess(_batch: Block[], currentBlock: Block, index: number) {
    const nextBlock = index < _batch.length - 1 ? _batch[index + 1] : null;
    return processNotionBlock(
      rawContentArray,
      currentBlock,
      nextBlock,
      listIndex,
      limit,
      options
    );
  }

  async function batchProcess(_: Block[]) {
    // process the batch
    return callFunctionsSequentially(
      _.map(
        (block, index) => () =>
          blockProcess(_, block, index).then(([_listIndex, _limitLeft]) => {
            listIndex = _listIndex;
            limitLeft = _limitLeft;
            return _listIndex;
          })
      )
    ).finally(() => {
      // reset the batcher-batch
      batch = [];
    });
  }

  for await (const block of blocksIter) {
    // cancel if limitLeft is 0
    if (!limitLeft) break;
    // batch-batching
    batch.push(block);
    // processing the batch
    if (batch.length === 25) await batchProcess(batch);
  }
  // After the async loop batch-batcher is done, process any remaining blocks in the batch
  if (batch.length > 0) await batchProcess(batch);

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
