import {extractIframeUrl, hasText, notionRichTextParser, trimString} from "./text";
import {NotionBlocksMarkdownParser} from "@notion-stuff/blocks-markdown-parser";
import {markdownToTxt} from "markdown-to-txt";
const NBMPInstance = NotionBlocksMarkdownParser.getInstance({
  emptyParagraphToNonBreakingSpace: false,
});
import {string_to_unicode_variant as toUnicodeVariant} from "string-to-unicode-variant";
import {FormattingOptions, NotionBlockType} from "types";

function mkdwn(block) {
  try {
    let markdown = NBMPInstance.parse([block]);
    return markdown;
  } catch (e) {
    console.log("An error occurred while parsing the block", e);
    return "";
  }
}

export function parseNotionBlockToText(
  block,
  nextBlock,
  index,
  options?: FormattingOptions
): [string, number] {
  let markdown = mkdwn(block);
  const type = block.type as NotionBlockType;
  const hasChildren = block.has_children;
  const isListItem = type == "numbered_list_item";
  const isBulletItem = type == "bulleted_list_item";
  const isDivider = type == "divider";
  const isEmbed = type == "embed";
  const isMedia = type == "video" || type == "image";
  const isParagraph = type == "paragraph";
  const isText = ["paragraph", "heading_1", "heading_2", "heading_3"].includes(type);
  const paragraph = getParagraphText(block);

  const isNextBlockParagraph = nextBlock?.type == "paragraph";
  const nextParagraph = getParagraphText(nextBlock);
  const isNextParagraphEmpty = isNextBlockParagraph && !hasText(trimString(nextParagraph));

  if (isDivider) return ["---", index];
  const iframeUrl = isEmbed ? extractIframeUrl(markdown) : null;
  if (iframeUrl?.includes("widgets.notionsocial.app")) return ["", index];
  if (iframeUrl) return [iframeUrl, index];

  if (!hasText(paragraph) || isMedia || hasChildren) return ["", index];

  if (index && !isListItem) index = 0;
  if (isListItem) index++;

  let formatted = formatMarkdown(markdown);

  let text = markdownToTxt(formatted, {gfm: false}).split("\n\n").join("\n");
  const trimmedText = trimString(formatted);
  if (isText) {
    if (isParagraph) text = trimmedText;
    if (options?.addLineBreakOnParagraphBlock && !isNextParagraphEmpty) text = text + "\n";
  }
  if (text && isListItem) text = `${index}. ${text}`;
  if (text && isBulletItem) text = `• ${text}`;
  return [text, index];
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
