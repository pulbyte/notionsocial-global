import {
  FormattingOptions,
  NotionBlock,
  NotionPagePostConfig,
  ParsedNotionBlock,
  RichTextContent,
} from "./types";
import {PartialBlockObjectResponse} from "@notionhq/client/build/src/api-endpoints";
import {
  processNotionBlock,
  getRichTextContentFromParsedBlocks,
  getRichTextFromText,
} from "./_richtext";
import {arrayToAsyncIterator, callFunctionsSequentially} from "./utils";
import {Client, iteratePaginatedAPI} from "@notionhq/client";
import {hasText} from "./text";
import {processMedia} from "./publish";

export async function getNotionPageRichTextContent(
  config: NotionPagePostConfig
): Promise<RichTextContent> {
  const notion = new Client({
    auth: config._data.access_token,
    timeoutMs: 15000,
  });

  function getChildrenIterator(blockId: string) {
    const iterateArr = iteratePaginatedAPI(notion.blocks.children.list, {
      block_id: blockId,
    });
    return iterateArr;
  }

  const pageChildrenIterator = getChildrenIterator(config._pageId);

  const {richText} = await getContentFromNotionBlocksAsync(
    pageChildrenIterator,
    config.formattingOptions,
    getChildrenIterator
  );

  return richText;
}

export async function getRichTextContent(
  config: NotionPagePostConfig
): Promise<RichTextContent> {
  let richText = await getNotionPageRichTextContent(config);
  // Fallback to the page title if the body is empty
  if (!hasText(richText?.text) && hasText(config.titleText)) {
    const titleFromProp = getRichTextFromText(config.titleText);
    richText = titleFromProp;
  }
  // The main priority is the caption in the property
  if (hasText(config.captionText)) {
    const captionFromProp = getRichTextFromText(config.captionText);
    richText = captionFromProp;
  }
  return richText;
}

export async function processRichTextContentMedia(
  richText: RichTextContent,
  config: NotionPagePostConfig
): Promise<RichTextContent> {
  if (richText.paragraphs) {
    for (const paragraph of richText.paragraphs) {
      if (paragraph.media) {
        paragraph.media = await processMedia(
          paragraph.media,
          config.filesToDownload,
          config._postRecord.processed_media
        );
      }
    }
  }
  return richText;
}

type NotionBlocksIter = AsyncIterableIterator<NotionBlock | PartialBlockObjectResponse>;

// New helper function for iterating and processing blocks
export async function getContentFromNotionBlocksAsync(
  blocksArray: NotionBlocksIter | NotionBlock[],
  options?: FormattingOptions,
  getChildrenIterator?: (blockId: string) => NotionBlocksIter,
  charLimit?: number
): Promise<{richText: RichTextContent; blocks: NotionBlock[]}> {
  const iterator = Array.isArray(blocksArray)
    ? arrayToAsyncIterator(blocksArray)
    : blocksArray;
  const blocks: NotionBlock[] = [];
  let parsedBlocks: ParsedNotionBlock[] = [];
  let listIndex = 0;
  let limitLeft = Number(charLimit) || 10000;
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
        const {blocks: childBlocks} = await getContentFromNotionBlocksAsync(
          iterator,
          options,
          getChildrenIterator,
          limitLeft
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
      parsedBlocks,
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

  return {richText: getRichTextContentFromParsedBlocks(parsedBlocks), blocks};
}
