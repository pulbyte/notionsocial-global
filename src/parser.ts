import {extractIframeUrl, hasText, matchIframe, notionRichTextParser} from "./text";
import {NotionBlocksMarkdownParser} from "@notion-stuff/blocks-markdown-parser";
import {markdownToTxt} from "markdown-to-txt";
const NBMPInstance = NotionBlocksMarkdownParser.getInstance({
  emptyParagraphToNonBreakingSpace: false,
});
import {string_to_unicode_variant as toUnicodeVariant} from "string-to-unicode-variant";
import {PublishMedia} from "./types";
import {getMediaFromNotionFile} from "./media";

export function parseNotionBlockToText(block) {
  let parsedMkdwn = NBMPInstance.parse([block]);

  const isDivider = parsedMkdwn.includes("---");
  if (isDivider) return "---";

  if (matchIframe(parsedMkdwn)) {
    const iframeUrl = extractIframeUrl(parsedMkdwn);
    return iframeUrl;
  }

  const isEmpty = isTextEmpty(block);
  const isVideo = checkIfVideo(parsedMkdwn);
  if (isEmpty || isVideo) return "";

  const transformed = transformMarkdown(parsedMkdwn);
  parsedMkdwn = transformed;

  let parsedContent = markdownToTxt(parsedMkdwn, {gfm: false});
  return parsedContent.split("\n\n").join("\n");
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

export function transformMarkdown(markdown) {
  // Transform bold text
  // Match both bold and italic
  const boldItalicRegex = /(\*\*_|_\*\*)([^*_]+?)(\*\*_|_\*\*)/g;
  markdown = markdown.replace(boldItalicRegex, (_, start, p1, end) => {
    return toUnicodeVariant(p1, "bold italic sans");
  });

  // Transform bold text
  markdown = markdown.replace(/\*\*([^*]+?)\*\*/g, (_, p1) => {
    return toUnicodeVariant(p1, "bold sans");
  });

  // Transform italic text enclosed in underscores
  markdown = markdown.replace(/_([^_]+?)_/g, (_, p1) => {
    return toUnicodeVariant(p1, "italic sans");
  });

  markdown = markdown.replace(/- \[x\] (.*?)\n/g, (_, p1) => {
    return `✅ ${p1}\n`;
  });

  markdown = markdown.replace(/- \[ \] (.*?)\n/g, (_, p1) => {
    return `⬜ ${p1}\n`;
  });

  return markdown;
}

export function getMediaFromNotionBlock(block): Promise<PublishMedia | null> {
  const {type} = block;
  if (type == "image" || type == "video") {
    return getMediaFromNotionFile(block[type]);
  } else return Promise.resolve(null);
}
