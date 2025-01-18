import {SUPPORTED_NOTION_CONTENT_BLOCKS} from "env";
import {
  extractIframeUrl,
  hasText,
  notionRichTextParser,
  numberToLetter,
  numberToRoman,
  trimString,
} from "./text";
import {NotionBlocksMarkdownParser} from "@notion-stuff/blocks-markdown-parser";
import {markdownToTxt} from "markdown-to-txt";
const NBMPInstance = NotionBlocksMarkdownParser.getInstance({
  emptyParagraphToNonBreakingSpace: false,
});
import {string_to_unicode_variant as toUnicodeVariant} from "string-to-unicode-variant";
import {FormattingOptions, NotionBlock, NotionBlockType, ParsedNotionBlock} from "types";

function mkdwn(block) {
  try {
    let markdown = NBMPInstance.parse([block]);
    return markdown;
  } catch (e) {
    console.warn("An error occurred while parsing the block", e.message);
    return "";
  }
}

export function parseNotionBlockToText(
  block: NotionBlock,
  nextBlock: NotionBlock | null,
  listIndex: number,
  nestIndex: number,
  options?: FormattingOptions,
  parentBlock?: NotionBlock
): [ParsedNotionBlock, number, number] {
  let markdown = mkdwn(block);
  const type = block.type as NotionBlockType;
  const hasChildren = block.has_children;
  const hasChildrenBlocks = block.children?.length > 0;
  const isNumberedListItem = type == "numbered_list_item";
  const parentType = block.parent?.type;
  const isNested = parentType == "block_id";
  const isBulletItem = type == "bulleted_list_item";
  const stacked = ["bulleted_list_item", "numbered_list_item", "to_do"];
  const isStacked = stacked.includes(type);
  const isList = isNumberedListItem || isBulletItem;
  const isDivider = type == "divider";
  const isEmbed = type == "embed";
  const isMedia = type == "video" || type == "image";
  const isText = ["paragraph", "heading_1", "heading_2", "heading_3"].includes(type);
  const isParagraph = type == "paragraph";
  const paragraph = getParagraphText(block);
  const isEmpty = !hasText(paragraph);
  const isToggleable = block[type]?.["is_toggleable"];
  const nextParagraph = getParagraphText(nextBlock);
  const notSupported = !SUPPORTED_NOTION_CONTENT_BLOCKS.includes(type);
  const isNextBlockEmpty = nextParagraph && !hasText(trimString(nextParagraph));

  function __(result?: string | boolean): [ParsedNotionBlock, number, number] {
    const obj: ParsedNotionBlock =
      typeof result === "boolean"
        ? {type: "divider"}
        : typeof result === "string"
        ? {
            type: "text",
            content: result || "",
            ...(parentBlock && {parentBlockType: parentBlock}),
          }
        : {type: "nil", content: null};
    return [obj, listIndex, nestIndex];
  }

  if (isDivider) return __(true);

  if ((!isText && !isList && hasChildren) || isMedia || isToggleable || notSupported)
    return __();

  const iframeUrl = isEmbed ? extractIframeUrl(markdown) : null;
  if (iframeUrl?.includes("widgets.notionsocial.app")) return __();
  if (iframeUrl) return __(iframeUrl);
  if (isEmpty) return __("");

  if (listIndex && !isNumberedListItem) listIndex = 0;
  if (isNumberedListItem) listIndex++;

  // Calculate indent with 2 special spaces per nest level, starting with 2 spaces at level 1
  const indent = "⠀".repeat(2 * nestIndex);

  let childrenText = "";
  let childrenListIndex = 0;

  if (hasChildrenBlocks) {
    nestIndex++;
    for (let i = 0; i < block.children.length; i++) {
      const child = block.children[i];
      const [result, _index, _nestIndex] = parseNotionBlockToText(
        child,
        nextBlock,
        childrenListIndex,
        nestIndex,
        options,
        block
      );
      childrenListIndex = _index;
      const childText = result.type == "text" ? result.content : "";
      if (childText) {
        childrenText += `\n${indent}${childText}`;
      }
    }
  } else nestIndex = 1;

  let formatted = formatMarkdown(markdown);
  let text = markdownToTxt(formatted, {gfm: false}); //.split("\n\n").join("\n");

  if (text && isNumberedListItem)
    text = `${getNumberedListPrefix(listIndex, nestIndex, isNested)}. ${text}`;
  if (text && isBulletItem) text = `${getBulletListPrefix(nestIndex, isNested)} ${text}`;

  if (isParagraph) text = trimString(formatted);

  text += childrenText;

  if (
    options?.addLineBreakOnParagraphBlock &&
    !isNextBlockEmpty &&
    !parentBlock &&
    (isStacked ? nextBlock?.type != block.type : true)
  )
    text = text + "\n";
  return __(text);
}
function getBulletListPrefix(nestIndex: number, isNested: boolean) {
  // Different bullet styles for different nesting levels
  const bullets = ["•", "◦", "▪"];
  const bullet = bullets[(nestIndex - 1) % bullets.length];
  // return bullet || "•";
  if (isNested) return "◦";
  else return "•";
  // const bullets = ["•","◦", "▪"];
  // return bullets[(nestIndex - 1) % bullets.length];
}

function getNumberedListPrefix(listIndex: number, nestIndex: number, isNested: boolean) {
  // Different numbering styles for different nesting levels
  if (isNested) return numberToLetter(listIndex);
  else return listIndex;
  // switch (nestIndex % 4) {
  //   case 0:
  //     return listIndex; // 1, 2, 3
  //   case 1:
  //     return numberToLetter(listIndex); // a, b, c
  //   case 2:
  //     return numberToRoman(listIndex); // i, ii, iii
  //   case 3:
  //     return numberToLetter(listIndex); // a, b, c (repeats)
  // }
  // return listIndex;
}

function getParagraphText(block) {
  if (!block) return "";
  const richTextArray = block[block["type"]]?.["rich_text"];
  if (!richTextArray) return "";
  const richText = notionRichTextParser(richTextArray);
  return richText;
}

export function formatMarkdown(text) {
  // Transform markdown URLs
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
    return linkText;
  });

  // Transform bold and italic text
  const boldItalicRegex = /(\*\*_|_\*\*)([^*_]+?)(\*\*_|_\*\*)/g;
  text = text.replace(boldItalicRegex, (_, start, p1) => {
    return applyStyleToText(p1, "bold italic sans");
  });

  // Transform bold text
  text = text.replace(/\*\*([^*]+?)\*\*/g, (_, p1) => {
    return applyStyleToText(p1, "bold sans");
  });

  // Transform italic text enclosed in underscores
  text = text.replace(
    /(?<!\S)_\s*([^_]+?)\s*_(?!\S)|\[_\s*([^_]+?)\s*_\](\([^)]+\))/g,
    (match, p1, p2, p3, offset, string) => {
      // Check if it's a markdown-style link
      if (p2 && p3) {
        return `[${applyStyleToText(p2.trim(), "italic sans")}]${p3}`;
      }

      // Check if the underscore is part of a URL or if the text contains a URL
      const urlRegex = /https?:\/\/[^\s]+/g;
      let isUrlRelated = false;
      let urlMatch;

      // Check if the entire matched text contains a URL
      if (urlRegex.test(p1)) {
        isUrlRelated = true;
      } else {
        // Check if the underscore is part of a URL in the larger context
        while ((urlMatch = urlRegex.exec(string)) !== null) {
          if (offset >= urlMatch.index && offset < urlMatch.index + urlMatch[0].length) {
            isUrlRelated = true;
            break;
          }
        }
      }

      // Check if the underscores are part of a word
      const beforeChar = string[offset - 1] || "";
      const afterChar = string[offset + match.length] || "";
      const isPartOfWord = /\w/.test(beforeChar) || /\w/.test(afterChar);

      // If not URL-related, not part of a word, and properly isolated, apply the italic transformation
      return isUrlRelated || isPartOfWord ? match : applyStyleToText(p1.trim(), "italic sans");
    }
  );

  text = text.replace(/- \[x\] (.*?)\n/g, (_, p1) => {
    return `✅ ${p1}\n`;
  });

  text = text.replace(/- \[ \] (.*?)\n/g, (_, p1) => {
    return `⬜ ${p1}\n`;
  });

  return text;
}

function applyStyleToText(text, style) {
  const urlRegex = /https?:\/\/[^\s]+/g;
  let result = "";
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    // Apply style to the text before the URL
    result += toUnicodeVariant(text.slice(lastIndex, match.index), style);
    // Add the URL as is, without applying style
    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  // Apply style to any remaining text after the last URL
  result += toUnicodeVariant(text.slice(lastIndex), style);

  return result;
}
