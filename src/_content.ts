import {extractTags, hasText, trimAndRemoveWhitespace} from "./text";
import TwitterText from "twitter-text";
const {parseTweet} = TwitterText;
import {BaseLinkedInPost, BaseTweet, Paragraph, PostMediaFile, Thread, XContent} from "types";
import {extractTweetIdFromUrl} from "./_url";

/**
 * Converts paragraphs of text into X (Twitter) content with associated media.
 * Each paragraph is processed into one or more tweet posts, with the first post
 * getting the media attachment and subsequent posts having no media.
 *
 * @param paragraphs - Array of text paragraphs to convert
 * @param maxPostLength - Maximum character length for each post (default: 280)
 * @returns Array of XContent objects ready for posting
 */
export function getXContentFromParagraphs(
  paragraphs: Array<{text: string; media?: PostMediaFile[]}>,
  maxPostLength = 280
): XContent {
  const content: XContent = [];

  // Process each paragraph
  paragraphs.forEach((paragraph, paragraphIndex) => {
    // Split the paragraph text into multiple tweet posts if needed
    const tweetPosts = getXContentFromText(paragraph.text, maxPostLength);
    // Extract the media tagged usernames
    const mediaTaggedUsernames = extractTags(
      paragraph.media?.map((m) => m.description).join(" ") || ""
    );
    // Extract the first post and attach media to it
    const firstPost = tweetPosts.splice(0, 1)[0];
    content.push({
      ...firstPost,
      ...(paragraph.media?.length > 0 && {media: paragraph.media}),
      ...(mediaTaggedUsernames?.length > 0 && {mediaTaggedUsernames}),
    });
    // Push the rest of the posts to the content
    tweetPosts.forEach((post) => content.push(post));
  });

  // Filter out empty posts (no text, repost ID, or media)
  const filteredContent = content.filter((post) => {
    return hasText(post.text) || hasText(post.repostId) || !!post.media?.length;
  });

  return filteredContent;
}

/**
 * Extracts X (Twitter) tweets from a text string, splitting it into multiple posts
 * if the content exceeds the maximum post length.
 *
 * @param text - The input text to process
 * @param maxPostLength - Maximum character length for each post (default: 280)
 * @returns Object containing posts array and metadata (quotePostId, replyToPostId, repostId)
 */
export function getXContentFromText(text: string, maxPostLength = 280): BaseTweet[] {
  // Extract base tweet information and sanitize text
  const {text: sanitizedText, quotePostId, replyToPostId, repostId} = parseTextForXPost(text);

  // Split text into words for processing
  const words = sanitizedText.split(" ");
  const tweetPosts: BaseTweet[] = [];

  // Initialize with first word (or empty string if no words)
  let currentText: string = words[0] || "";

  // Process remaining words starting from the second word
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const newText = currentText + " " + word;

    // Check if adding this word would exceed the maximum post length
    if (parseTweet(newText).weightedLength > maxPostLength) {
      // Save current post and start a new one with the current word
      tweetPosts.push({text: currentText});
      currentText = word;
    } else {
      // Add word to current post
      currentText = newText;
    }
  }

  // Add the final post to the array
  tweetPosts.push({text: currentText});

  // Add metadata to the first tweet only
  tweetPosts.map((post, index) => {
    if (index === 0) {
      return Object.assign(post, {
        ...(quotePostId && {quotePostId}),
        ...(replyToPostId && {replyToPostId}),
        ...(repostId && {repostId}),
      });
    }
    return post;
  });

  return tweetPosts;
}

export const TweetPostExtractRegex =
  /(https:\/\/(www\.)?(twitter\.com|x\.com)\/(i\/web\/status\/|status\/|\w+\/status\/)\d+\S*)/;

export function removeFirstTweetPostUrlFromText(text: string): string {
  return text.replace(TweetPostExtractRegex, "");
}

export function parseTextForXPost(text: string): BaseTweet {
  const __: BaseTweet = {text: ""};
  if (!text) return __;

  const urlMatch = text.match(TweetPostExtractRegex);

  if (urlMatch) {
    const url = urlMatch[0];
    const tweetId = extractTweetIdFromUrl(url);
    const noText = !hasText(trimAndRemoveWhitespace(removeFirstTweetPostUrlFromText(text)));
    // Check if there is only the url, Which mean it is a retweet
    if (noText) {
      __.repostId = tweetId;
      text = "";
    }
    const trimmedText = text.trim();
    // Check if the URL is at the beginning of the text
    if (trimmedText.startsWith(url)) {
      __.replyToPostId = tweetId;
      text = removeFirstTweetPostUrlFromText(text);
    } else if (trimmedText.endsWith(url)) {
      // URL is at the end or middle, treat it as a reply
      __.quotePostId = tweetId;
      text = removeFirstTweetPostUrlFromText(text).trim();
    }
  }
  return Object.assign(__, {text});
}

export function chunkText(text: string, maxTextLength: number) {
  const words = text.split(" ");
  const chunks: string[] = [];
  let currentChunk = words[0] || ""; // Start with first word

  // Start loop from second word
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const newChunk = currentChunk + " " + word;
    const exceedsLength = newChunk.length > maxTextLength;

    if (exceedsLength) {
      chunks.push(currentChunk);
      currentChunk = word;
    } else {
      currentChunk = newChunk;
    }
  }
  chunks.push(currentChunk);
  return chunks;
}

export function chunkParagraphs(paragraphs: Paragraph[], maxTextLength: number): Paragraph[] {
  let __: Paragraph[] = [];
  paragraphs.forEach((paragraph) => {
    const chunks = chunkText(paragraph.text, maxTextLength);
    // Add the media to the first chunk
    const firstChunk = chunks.splice(0, 1)[0];
    __.push({text: firstChunk, media: paragraph.media});
    // Add the remaining chunks without media
    chunks.forEach((text) => __.push({text}));
  });
  // Filter out empty chunks
  __ = __.filter((obj) => {
    return hasText(obj.text) || obj.media?.length > 0;
  });
  return __;
}

export const LinkedInPostExtractRegex =
  /(https:\/\/(www\.)?linkedin\.com\/embed\/feed\/update\/(urn:li:(share|ugcPost):\d+)(\?[^\s]*)?)/;

export function removeFirstLinkedInPostUrlFromText(text: string): string {
  return text.replace(LinkedInPostExtractRegex, "");
}

export function parseTextForLinkedInPost(text: string): BaseLinkedInPost {
  if (!text) return {text: "", quotePostId: null, replyToPostId: null, repostId: null};

  const urlMatch = text.match(LinkedInPostExtractRegex);
  let quotePostId = null;
  let replyToPostId = null;
  let repostId = null;

  if (urlMatch) {
    const url = urlMatch[0];
    const postId = urlMatch[3];
    const noText = !hasText(trimAndRemoveWhitespace(removeFirstLinkedInPostUrlFromText(text)));
    if (noText) {
      repostId = postId;
      text = "";
    } else {
      const trimmedText = trimAndRemoveWhitespace(text);
      if (trimmedText.startsWith(url)) {
        replyToPostId = postId;
        // Remove the URL and any following newline character
        text = text
          .replace(new RegExp(`${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n?`), "")
          .trim();
      } else {
        quotePostId = postId;
        text = removeFirstLinkedInPostUrlFromText(text).trim();
      }
    }
  }

  return {text, quotePostId, replyToPostId, repostId};
}
