import {getMediaFromNotionBlock, getStaticMediaFromNotionBlock} from "./_media";
import {parseNotionBlockToText} from "./parser";
import {hasText, trimString} from "./text";
import {
  FormattingOptions,
  Media,
  NotionBlock,
  ParsedNotionBlock,
  RichTextContent,
  Paragraph,
} from "types";

export function getRichTextFromText(string: string, limit = 63206): RichTextContent {
  const text: string = string.substring(0, limit);
  return {
    text,
    paragraphs: [{text, media: []}],
    hasMediaInParagraphs: false,
  };
}
export function convertSectionsToParagraphs(
  textArray: string[],
  mediaArray: Media[][]
): Paragraph[] {
  return textArray.map((text, index) => ({
    text,
    media: mediaArray[index] || [],
  }));
}

export function getRichTextFromNotionBlocksSync(blocks): RichTextContent {
  const limit = 63206;
  let parsedBlocks: ParsedNotionBlock[] = [];

  let listIndex = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const nextBlock = blocks[i + 1];
    // if (!SUPPORTED_NOTION_CONTENT_BLOCKS?.includes(block["type"])) break;
    const [_listIndex, _limitLeft] = processStaticNotionBlock(
      parsedBlocks,
      block,
      nextBlock,
      listIndex,
      limit
    );
    listIndex = _listIndex;
    if (!_limitLeft) break;
  }

  return getRichTextContentFromParsedBlocks(parsedBlocks);
}
export function getRichTextContentFromSections(textArray: string[], mediaArray: Media[][]) {
  const text = textArray.join("\n\n");
  const paragraphs = convertSectionsToParagraphs(textArray, mediaArray);
  return {
    text,
    paragraphs,
    hasMediaInParagraphs: paragraphs.some((p) => p.media?.length > 0),
  };
}
/**
 * Notion Blocks to Rich Text
 */
/**
 * Converts parsed Notion blocks into organized text and media sections
 *
 * This function processes an array of parsed Notion blocks and organizes them into
 * separate text and media sections. It handles dividers, text content, and media
 * attachments, ensuring proper grouping and cleanup of empty sections.
 *
 * @param parsedBlocks - Array of parsed Notion blocks to process
 * @returns Tuple containing arrays of cleaned-up text sections and corresponding media sections
 */
export function getRichTextContentFromParsedBlocks(
  parsedBlocks: ParsedNotionBlock[]
): RichTextContent {
  // Initialize storage arrays for final output
  const mediaSections: Media[][] = [];
  const textSections: string[] = [];

  // Buffers for accumulating content during processing
  let mediaBuffer: Media[] = [];
  let textBuffer = "";

  // Process each parsed block sequentially
  parsedBlocks.forEach((parsedBlock, blockIndex) => {
    const [updatedTextBuffer, updatedMediaBuffer] = processParsedNotionBlock(
      parsedBlock,
      blockIndex,
      textSections,
      textBuffer,
      mediaSections,
      mediaBuffer,
      parsedBlocks
    );

    // Update buffers for next iteration
    textBuffer = updatedTextBuffer;
    mediaBuffer = updatedMediaBuffer;
  });

  // Clean up and validate sections
  cleanupSections(textSections, mediaSections);

  const text = textSections.join("\n\n");
  const paragraphs = convertSectionsToParagraphs(textSections, mediaSections);
  return {
    text,
    paragraphs,
    hasMediaInParagraphs: paragraphs.some((p) => p.media?.length > 0),
  };
}

/**
 * Cleans up text and media sections by removing empty sections and handling media-only sections
 *
 * @param textSections - Array of text sections to clean up
 * @param mediaSections - Corresponding array of media sections
 */
function cleanupSections(textSections: string[], mediaSections: Media[][]): void {
  // Process sections in reverse order to avoid index shifting issues
  for (let index = textSections.length - 1; index >= 0; index--) {
    const text = trimString(textSections[index]);
    const hasTextContent = hasText(text);
    const hasMediaContent = mediaSections[index]?.length > 0;

    if (!hasTextContent && hasMediaContent) {
      // Section has media but no text - keep media, clear text
      textSections[index] = "";
    } else if (!hasTextContent && !hasMediaContent) {
      // Section has neither text nor media - remove entirely
      textSections.splice(index, 1);
      mediaSections.splice(index, 1);
    }
  }
}
/**
 * Process a single parsed notion block
 */
export function processParsedNotionBlock(
  parsed: ParsedNotionBlock,
  i: number,
  textSections: string[],
  textBuffer: string,
  mediaSections: Media[][],
  mediaBuffer: Media[],
  parsedBlocks: ParsedNotionBlock[]
): [string, Media[]] {
  let text = "";
  if (parsed.type === "text") {
    text = parsed.content || "";
  }
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

/**
 * Process a single Notion block and add it to the parsed blocks array
 *
 * @param parsedBlocks - Array to store parsed Notion blocks
 * @param block - Current Notion block to process
 * @param nextBlock - Next Notion block for context
 * @param listIndex - Current list index for numbered lists
 * @param limit - Character limit for text content (default: 63206)
 * @param media - Media object associated with the block (if any)
 * @param options - Formatting options for text parsing
 * @returns Tuple of [listIndex, leftLimit] - updated list index and remaining character limit
 */
function processNotionBlockCommon(
  parsedBlocks: ParsedNotionBlock[],
  block: NotionBlock,
  nextBlock: NotionBlock,
  listIndex: number,
  limit = 63206,
  media: Media | null,
  options?: FormattingOptions
): [number, number] {
  // Add media block if present
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

  // Handle text content with character limit enforcement
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
    // Add non-text blocks without character limit restrictions
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
