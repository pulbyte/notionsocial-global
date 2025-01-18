import {Content, FormattingOptions, Media, NotionBlock, ParsedNotionBlock} from "./types";
import {PartialBlockObjectResponse} from "@notionhq/client/build/src/api-endpoints";
import {
  convertTextToThreads,
  convertSectionsToTwitterThread,
  processNotionBlock,
  processParsedNotionBlocks,
  convertSectionsToParagraphs,
} from "_content";
import {hasText} from "text";
import {arrayToAsyncIterator, callFunctionsSequentially} from "utils";

type NotionBlocksIter = AsyncIterableIterator<NotionBlock | PartialBlockObjectResponse>;

// New helper function for iterating and processing blocks
export async function processNotionBlocks(
  blocksArray: NotionBlocksIter | NotionBlock[],
  options?: FormattingOptions,
  charLimit: number = 10000,
  getChildrenIterator?: (blockId: string) => NotionBlocksIter
): Promise<{
  blocks: NotionBlock[];
  caption: string;
  textArray: string[];
  mediaArray: Media[][];
}> {
  const iterator = Array.isArray(blocksArray)
    ? arrayToAsyncIterator(blocksArray)
    : blocksArray;
  const blocks: NotionBlock[] = [];
  let rawContentArray: ParsedNotionBlock[] = [];
  let listIndex = 0;
  let limitLeft = Number(charLimit);
  let batch: NotionBlock[] = [];

  async function processBlock(
    _batch: NotionBlock[],
    currentBlock: NotionBlock,
    index: number
  ) {
    const nextBlock = index < _batch.length - 1 ? _batch[index + 1] : null;

    // Recursively process children if they exist
    if (currentBlock.has_children && getChildrenIterator) {
      try {
        const iterator = Array.isArray(currentBlock.children)
          ? arrayToAsyncIterator(currentBlock.children)
          : getChildrenIterator(currentBlock.id);
        const {blocks: childBlocks} = await processNotionBlocks(
          iterator,
          options,
          limitLeft,
          getChildrenIterator
        );
        currentBlock.children = childBlocks;
      } catch (e) {
        console.error("Error processing children blocks", e);
      }
    }
    // push the current block to the blocks array
    blocks.push(currentBlock);

    // Process current block
    const [newListIndex, newLimitLeft] = await processNotionBlock(
      rawContentArray,
      currentBlock,
      nextBlock,
      listIndex,
      charLimit,
      options
    );
    return [newListIndex, newLimitLeft];
  }

  async function batchProcess(_: NotionBlock[]) {
    // process the batch
    return callFunctionsSequentially(
      _.map(
        (block, index) => () =>
          processBlock(_, block, index).then(([_listIndex, _limitLeft]) => {
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

  for await (const block of iterator) {
    if (!limitLeft) {
      console.log(`Character limit of ${charLimit} for parsing blocks exhausted.`);
      break;
    }
    batch.push(block as NotionBlock);
    if (batch.length === 25) await batchProcess(batch);
  }
  if (batch.length > 0) await batchProcess(batch);

  const [caption, textArray, mediaArray] = processParsedNotionBlocks(rawContentArray);
  return {blocks, caption, textArray, mediaArray};
}

// Refactored main function
export async function getContentFromNotionBlocksAsync(
  blocksIter: NotionBlocksIter,
  options?: FormattingOptions,
  getChildrenIterator?: (blockId: string) => NotionBlocksIter,
  chatLimit?: number
): Promise<[Content & {hasMedia: boolean}, NotionBlock[]]> {
  const {caption, textArray, mediaArray, blocks} = await processNotionBlocks(
    blocksIter,
    options,
    chatLimit,
    getChildrenIterator
  );

  return getContentFromProcessedBlocks(caption, textArray, mediaArray, blocks);
}
export function getContentFromProcessedBlocks(
  caption: string,
  textSections: string[],
  mediaSections: Media[][],
  blocks: NotionBlock[]
): [Content & {hasMedia: boolean}, NotionBlock[]] {
  // Process media and text arrays
  mediaSections.forEach((mediaArr, index) => {
    const ht = hasText(textSections[index]);
    const hm = mediaArr?.length > 0;
    if (!ht && hm) {
      textSections[index] = "";
    }
  });

  // Convert to different formats
  const twitter = convertSectionsToTwitterThread(textSections, mediaSections);
  const threads = convertTextToThreads(textSections, mediaSections, 500);
  const bluesky = convertTextToThreads(textSections, mediaSections, 300);
  const paragraphs = convertSectionsToParagraphs(textSections, mediaSections);

  const content: Content & {hasMedia: boolean} = {
    text: caption, // or however you want to handle the caption
    paragraphs,
    threads,
    bluesky,
    twitter,
    hasMedia: paragraphs.some((p) => p.media?.length > 0),
  };

  return [content, blocks];
}
