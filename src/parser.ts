import {extractIframeUrl, hasText, matchIframe, notionRichTextParser} from "./text";
import {NotionBlocksMarkdownParser} from "@notion-stuff/blocks-markdown-parser";
import {markdownToTxt} from "markdown-to-txt";
const NBMPInstance = NotionBlocksMarkdownParser.getInstance({
  emptyParagraphToNonBreakingSpace: false,
});
import {string_to_unicode_variant as toUnicodeVariant} from "string-to-unicode-variant";

export function parseNotionBlockToText(block) {
  let markdown = NBMPInstance.parse([block]);

  const isDivider = markdown.includes("---");
  if (isDivider) return "---";

  if (matchIframe(markdown)) {
    const iframeUrl = extractIframeUrl(markdown);
    return iframeUrl;
  }

  const isEmpty = isTextEmpty(block);
  const isVideo = checkIfVideo(markdown);
  if (isEmpty || isVideo) return "";

  let formatted = formatMarkdown(markdown);
  let text = markdownToTxt(formatted, {gfm: false});

  return text.split("\n\n").join("\n");
}

function checkIfVideo(inputString) {
  var pattern = /To be supported: https:\/\/[^\s]+/;
  return pattern.test(inputString);
}
function isTextEmpty(block) {
  if (!block) return true;
  const richTextArray = block[block["type"]]?.["rich_text"];
  if (!richTextArray) return true;
  const richText = notionRichTextParser(richTextArray);
  return !hasText(richText);
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
  text = text.replace(/_([^_]+?)_/g, (_, p1, offset, string) => {
    // Check if the underscore is part of a URL or if the text contains a URL
    const urlRegex = /https?:\/\/[^\s]+/g;
    let isUrlRelated = false;
    let match;

    // Check if the entire matched text contains a URL
    if (urlRegex.test(p1)) {
      isUrlRelated = true;
    } else {
      // Check if the underscore is part of a URL in the larger context
      while ((match = urlRegex.exec(string)) !== null) {
        if (offset >= match.index && offset < match.index + match[0].length) {
          isUrlRelated = true;
          break;
        }
      }
    }

    // If not URL-related, apply the italic transformation
    return isUrlRelated ? `_${p1}_` : toUnicodeVariant(p1, "italic sans");
  });

  text = text.replace(/- \[x\] (.*?)\n/g, (_, p1) => {
    return `✅ ${p1}\n`;
  });

  text = text.replace(/- \[ \] (.*?)\n/g, (_, p1) => {
    return `⬜ ${p1}\n`;
  });

  return text;
}
