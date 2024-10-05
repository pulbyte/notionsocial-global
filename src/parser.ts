import {extractIframeUrl, hasText, notionRichTextParser, trimString} from "./text";
import {NotionBlocksMarkdownParser} from "@notion-stuff/blocks-markdown-parser";
import {markdownToTxt} from "markdown-to-txt";
const NBMPInstance = NotionBlocksMarkdownParser.getInstance({
  emptyParagraphToNonBreakingSpace: false,
});
import {string_to_unicode_variant as toUnicodeVariant} from "string-to-unicode-variant";

export function parseNotionBlockToText(block, index): [string, number] {
  let markdown = NBMPInstance.parse([block]);
  const isListItem = block.type == "numbered_list_item";
  const isBulletItem = block.type == "bulleted_list_item";
  const isDivider = block.type == "divider";
  const isEmbed = block.type == "embed";
  const isMedia = block.type == "video" || block.type == "image";
  const isParagraph = block.type == "paragraph";
  const paragraph = getParagraphText(block);

  if (isDivider) return ["---", index];
  const iframeUrl = isEmbed ? extractIframeUrl(markdown) : null;
  if (iframeUrl) return [iframeUrl, index];

  if (!hasText(paragraph) || isMedia) return ["", index];

  if (index && !isListItem) index = 0;
  if (isListItem) index++;

  let formatted = formatMarkdown(markdown);

  let text = markdownToTxt(formatted, {gfm: false}).split("\n\n").join("\n");

  const trimmedText = trimString(formatted);
  if (isParagraph) text = trimmedText;
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
  // Transform bold text
  // Match both bold and italic
  const boldItalicRegex = /(\*\*_|_\*\*)([^*_]+?)(\*\*_|_\*\*)/g;
  text = text.replace(boldItalicRegex, (_, start, p1, end) => {
    return toUnicodeVariant(p1, "bold italic sans");
  });

  // Transform bold text
  text = text.replace(/\*\*([^*]+?)\*\*/g, (_, p1) => {
    // Check if p1 contains a URL
    const urlRegex = /https?:\/\/[^\s]+/g;
    let result = "";
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(p1)) !== null) {
      // Convert the text before the URL to bold
      result += toUnicodeVariant(p1.slice(lastIndex, match.index), "bold sans");
      // Add the URL as is, without converting to bold
      result += match[0];
      lastIndex = match.index + match[0].length;
    }

    // Convert any remaining text after the last URL to bold
    result += toUnicodeVariant(p1.slice(lastIndex), "bold sans");

    return result;
  });

  // Transform italic text enclosed in underscores
  text = text.replace(
    /(?<!\S)_\s*([^_]+?)\s*_(?!\S)|\[_\s*([^_]+?)\s*_\](\([^)]+\))/g,
    (match, p1, p2, p3, offset, string) => {
      // Check if it's a markdown-style link
      if (p2 && p3) {
        return `[${toUnicodeVariant(p2.trim(), "italic sans")}]${p3}`;
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
      return isUrlRelated || isPartOfWord ? match : toUnicodeVariant(p1.trim(), "italic sans");
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
