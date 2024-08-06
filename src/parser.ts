import {extractIframeUrl, hasText, matchIframe, notionRichTextParser} from "./text";
import {NotionBlocksMarkdownParser} from "@notion-stuff/blocks-markdown-parser";
import {markdownToTxt} from "markdown-to-txt";
import {marked} from "marked";
import {docMimeTypes, imageMimeTypes, videoMimeTypes} from "env";
const NBMPInstance = NotionBlocksMarkdownParser.getInstance({
  emptyParagraphToNonBreakingSpace: false,
});
import {string_to_unicode_variant as toUnicodeVariant} from "string-to-unicode-variant";
import {PublishMedia} from "types";
import {getMediaFromNotionFile} from "media";

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

  let parsedContent = markdownToTxt(parsedMkdwn, {renderer, gfm: false});
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
  markdown = markdown.replace(/\*\*([^*]+?)\*\*/g, (_, p1) => {
    return toUnicodeVariant(p1, "bold sans");
  });

  // Transform italic text enclosed in underscores
  markdown = markdown.replace(/__([^*_]+?)__/g, (_, p1) => {
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

export const renderer = new marked.Renderer();

renderer.strong = (text) => {
  // Transform the bold text using the 'scriptBold' font
  const transformedText = toUnicodeVariant(text, "bold sans");
  return transformedText;
};

renderer.em = (text) => {
  // Transform the italic text using the 'scriptItalic' font
  const transformedText = toUnicodeVariant(text, "italic sans");
  return transformedText;
};
export function getMediaFromNotionBlock(block): Promise<PublishMedia | null> {
  const {type} = block;
  if (type == "image" || type == "video") {
    return getMediaFromNotionFile(block[type]);
  } else return Promise.resolve(null);
}
export function getMediaType(mt) {
  if (imageMimeTypes.includes(mt)) return "image";
  else if (videoMimeTypes.includes(mt)) return "video";
  else if (docMimeTypes.includes(mt)) return "doc";
}
