import {
  NotionPageContent,
  FacebookContent,
  InstagramContent,
  YouTubeContent,
  LinkedInContent,
  ThreadsContent,
  BlueskyContent,
  PinterestContent,
  TikTokContent,
  XContent,
  MediaType,
  NotionPagePostConfig,
  PinterestBoard,
  Paragraph,
  Media,
  GmbContent,
} from "./types";
import {replaceLineBreaksWithEmptySpaces, hasText, sanitizePinterestBoardName} from "./text";
import {chunkParagraphs, getXContentFromParagraphs} from "./_content";
import {platformMimeTypeSupported} from "env";
import {getRichTextFromText} from "./_richtext";
import {makeMediaPostReady} from "./_media";
import {extractUrlFromString} from "./url";
import {SocialPlatformType} from "@pulbyte/social-stack-lib";

/**
 * Helper function to select the appropriate video thumbnail based on configuration and available media
 *
 * @param pageContent The Notion page content containing media and videoThumbnail
 * @param config The Notion page post configuration
 * @returns The selected thumbnail as MediaType or undefined if none available
 */
function selectVideoThumbnail(
  pageContent: NotionPageContent,
  config: NotionPagePostConfig
): MediaType | undefined {
  // Check if video thumbnail property is defined in config
  const useThumbnailProperty = hasText(config._data?.options?.video_thumbnail_image_prop);

  // If thumbnail property is defined and a thumbnail exists, use it
  if (useThumbnailProperty && pageContent.videoThumbnail) {
    return pageContent.videoThumbnail;
  }

  // Check if there's a video in the media array
  const hasVideo = pageContent.media && pageContent.media.some((m) => m.type === "video");

  // If there's a video, look for the first image in media to use as thumbnail
  if (hasVideo && pageContent.media && pageContent.media.length > 0) {
    const firstImage = pageContent.media.find((m) => m.type === "image");
    if (firstImage) {
      return firstImage;
    }
  }

  // No suitable thumbnail found
  return undefined;
}

/**
 * Helper function to process media for a specific platform and remove any thumbnail
 * from the media array if it's present
 *
 * @param media Original media array
 * @param thumbnail Thumbnail to remove from media array (if present)
 * @param platform Target social platform
 * @returns Processed media array with thumbnail removed
 */
function processMediaForPlatform<T extends "file" | "media">(
  media: MediaType[],
  platform: SocialPlatformType,
  thumbnail?: MediaType
) {
  if (!media || media.length === 0) {
    return [];
  }

  // Filter out the thumbnail from the media array if it exists
  const filteredMedia = thumbnail ? media.filter((m) => m.refId !== thumbnail.refId) : media;

  // Process media for the specific platform
  return filteredMedia.map((m) => {
    return makeMediaPostReady<T>(m, platform);
  });
}

/**
 * Helper function to process a thumbnail for a specific platform
 *
 * @param thumbnail Raw thumbnail media
 * @param platform Target social platform
 * @param asFile Whether to process as a file
 * @returns Processed thumbnail
 */
function processThumbnail<T extends "file" | "media">(
  thumbnail: MediaType | undefined,
  platform: SocialPlatformType
) {
  if (!thumbnail) {
    return undefined;
  }

  return makeMediaPostReady<T>(thumbnail, platform);
}

/**
 * Helper function to process media in paragraphs for a specific platform
 *
 * @param paragraphs Original paragraphs
 * @param platform Target social platform
 * @param asFile Whether to process as files
 * @returns Processed paragraphs with media processed for the platform
 */
function processParagraphsMedia<T extends "file" | "media">(
  paragraphs: Paragraph[] | undefined,
  platform: SocialPlatformType,
  propertyMedia: MediaType[]
) {
  if (!paragraphs) {
    return [];
  }

  return paragraphs.map((paragraph, index) => {
    let media: MediaType[] = [];

    if (index === 0 && propertyMedia && Array.isArray(propertyMedia)) {
      media = propertyMedia.concat(paragraph.media || []);
    } else {
      media = paragraph.media || [];
    }

    // Always process media for the platform
    return {
      ...paragraph,
      media: media?.map((m) => makeMediaPostReady<T>(m, platform)),
    };
  });
}

/**
 * Helper function to determine Facebook post type based on media, rules and config
 *
 * @param media The media array from page content
 * @param config The Notion page post configuration
 * @returns The Facebook post type (story, reel, video, carousel, image, text)
 */
export function determineFacebookPostType(
  media?: Array<Pick<Media, "type" | "mimeType">>,
  config?: NotionPagePostConfig
): FacebookContent["postType"] {
  if (!media || media.length === 0) return "text";

  const rules = config?.rules || {};

  // Filter media by type and supported formats
  const supportedVideoTypes = platformMimeTypeSupported["facebook"].video;
  const supportedImageTypes = platformMimeTypeSupported["facebook"].image;
  const supportedStoryImageTypes = platformMimeTypeSupported["facebook"].storyImage;

  const videos = media.filter(
    (m) => m.type === "video" && supportedVideoTypes.includes(m.mimeType || "")
  );
  const hasVideos = videos.length > 0;

  const images = media
    .filter((m) => m.type === "image" && supportedImageTypes.includes(m.mimeType || ""))
    .slice(0, 10);

  const storyMedia = media.filter(
    (m) =>
      (m.type === "image" && supportedStoryImageTypes.includes(m.mimeType || "")) ||
      (m.type === "video" && supportedVideoTypes.includes(m.mimeType || ""))
  );

  // Check rules for story and reel preferences
  const toUploadReel = rules["fb-reel>video"] || rules["reel>video"];
  const toUploadStory = rules["fb-story>feed"] || rules["story>feed"];

  // Determine post type based on rules and media content
  if (toUploadStory && storyMedia.length > 0) {
    return "story";
  }

  if (hasVideos) {
    if (toUploadReel) {
      return "reel";
    }
    return "video";
  }

  if (images.length > 1) {
    return "carousel";
  }

  if (images.length === 1) {
    return "image";
  }

  return "text";
}

/**
 * Convert NotionPageContent to Facebook-specific content format
 */
export function getFacebookContent(
  pageContent: NotionPageContent,
  config: NotionPagePostConfig
): FacebookContent {
  // Use platform-specific caption if available, otherwise use general text
  const text = config.platformCaptions?.facebook || pageContent.richText?.text || "";

  // Select and process thumbnail
  const rawThumbnail = selectVideoThumbnail(pageContent, config);
  const thumbnail = processThumbnail<"file">(rawThumbnail, "facebook");

  // Process media for Facebook platform and remove thumbnail if present
  const processedMedia = processMediaForPlatform<"media">(
    pageContent.media,
    "facebook",
    rawThumbnail
  );

  // Determine post type
  const postType = determineFacebookPostType(processedMedia, config);

  // Only include videoThumbnail for videos and reels
  const finalThumbnail = postType === "video" || postType === "reel" ? thumbnail : undefined;

  return {
    text: replaceLineBreaksWithEmptySpaces(text),
    media: processedMedia,
    videoThumbnail: finalThumbnail,
    ctaButton: config.ctaButton,
    ctaLink: config.ctaLink,
    postType: postType,
  };
}

/**
 * Convert NotionPageContent to Instagram-specific content format
 */
export function getInstagramContent(
  pageContent: NotionPageContent,
  config: NotionPagePostConfig,
  isPaidUser: boolean
): InstagramContent {
  // Use platform-specific caption if available, otherwise use general text
  const caption = config.platformCaptions?.instagram || pageContent.richText?.text || "";

  // Select and process thumbnail
  const rawThumbnail = selectVideoThumbnail(pageContent, config);
  const thumbnail = processThumbnail<"media">(rawThumbnail, "instagram");

  // Determine post type using the enhanced function
  const postType = determineInstagramPostType(pageContent.media, config, isPaidUser);

  // Process media for Instagram platform and remove thumbnail if present
  const processedMedia = processMediaForPlatform<"media">(
    pageContent.media,
    "instagram",
    // Only remove thumbnail for reels, Cause it's used in carousel
    postType === "reel" ? rawThumbnail : undefined
  );

  // Only include videoThumbnail for reels
  const finalThumbnail = postType === "reel" ? thumbnail : undefined;

  return {
    caption: replaceLineBreaksWithEmptySpaces(caption),
    media: processedMedia,
    videoThumbnail: finalThumbnail,
    imageUserTags: config.imageUserTags || [],
    collaboratorTags: config.collaboratorTags || [],
    locationTag: config.locationTag || "",
    postType: postType,
  };
}

/**
 * Convert NotionPageContent to YouTube-specific content format
 */
export function getYouTubeContent(
  pageContent: NotionPageContent,
  config: NotionPagePostConfig
): YouTubeContent {
  // Use platform-specific caption if available, otherwise use general text
  const description = config.platformCaptions?.youtube || pageContent.richText?.text || "";

  // Select and process thumbnail
  const rawThumbnail = selectVideoThumbnail(pageContent, config);
  const thumbnail = processThumbnail<"file">(rawThumbnail, "youtube");

  // Process media files for YouTube platform and remove thumbnail if present
  const mediaFiles = processMediaForPlatform<"file">(
    pageContent.media,
    "youtube",
    rawThumbnail
  );

  return {
    title: pageContent.title,
    description,
    media: mediaFiles,
    videoThumbnail: thumbnail,
    privacyStatus: config.youtubePrivacyStatus || "public",
  };
}

/**
 * Convert NotionPageContent to LinkedIn-specific content format
 */
export function getLinkedInContent(
  pageContent: NotionPageContent,
  config: NotionPagePostConfig
): LinkedInContent {
  // Use platform-specific caption if available, otherwise use general text
  const text = config.platformCaptions?.linkedin || pageContent.richText?.text || "";

  // Select and process thumbnail
  const rawThumbnail = selectVideoThumbnail(pageContent, config);
  const thumbnail = processThumbnail<"file">(rawThumbnail, "linkedin");

  // Process media files for LinkedIn platform and remove thumbnail if present
  const mediaFiles = processMediaForPlatform<"file">(
    pageContent.media,
    "linkedin",
    rawThumbnail
  );

  return {
    text,
    media: mediaFiles,
    title: pageContent.title,
    videoThumbnail: thumbnail,
  };
}

/**
 * Convert NotionPageContent to Threads-specific content format
 */
export function getThreadsContent(
  pageContent: NotionPageContent,
  config: NotionPagePostConfig
): ThreadsContent {
  const paragraphs = config.platformCaptions?.threads
    ? getRichTextFromText(config.platformCaptions.threads).paragraphs
    : pageContent.richText?.paragraphs;

  const thread = chunkParagraphs(paragraphs, 500);

  // Process media in paragraphs if available
  return processParagraphsMedia<"media">(thread, "threads", pageContent.media);
}

/**
 * Convert NotionPageContent to Bluesky-specific content format
 */
export function getBlueskyContent(
  pageContent: NotionPageContent,
  config: NotionPagePostConfig
): BlueskyContent {
  const paragraphs = config.platformCaptions?.bluesky
    ? getRichTextFromText(config.platformCaptions.bluesky).paragraphs
    : pageContent.richText?.paragraphs;

  const thread = chunkParagraphs(paragraphs, 300);

  // Process media in paragraphs if available
  return processParagraphsMedia<"file">(thread, "bluesky", pageContent.media);
}

/**
 * Convert NotionPageContent to Pinterest-specific content format
 */
export function getPinterestContent(
  pageContent: NotionPageContent,
  config: NotionPagePostConfig,
  pinterestBoards: PinterestBoard[]
): PinterestContent {
  // Use platform-specific caption if available, otherwise use general text
  const originalDescription =
    config.platformCaptions?.pinterest || pageContent.richText?.text || "";
  let [description, link] = extractUrlFromString(originalDescription, true);
  // Select and process thumbnail
  const rawThumbnail = selectVideoThumbnail(pageContent, config);
  const thumbnail = processThumbnail(rawThumbnail, "pinterest");

  // Process media files for Pinterest platform and remove thumbnail if present
  const mediaFiles = processMediaForPlatform(pageContent.media, "pinterest", rawThumbnail);

  // If content.boardId exists, validate and use it instead
  let boardOptionId = config.selectedPinterestBoard?.id;
  let boardOptionValue = sanitizePinterestBoardName(config.selectedPinterestBoard?.name);
  let board: PinterestBoard | null = null;
  if (config.selectedPinterestBoard) {
    board = pinterestBoards.find(
      (board) => boardOptionValue == board.name || boardOptionId == board.id
    );
  }

  return {
    description: description?.substring(0, 500),
    link,
    media: mediaFiles,
    title: pageContent.title?.substring(0, 100),
    videoThumbnail: thumbnail,
    board,
    altText: pageContent.altText?.substring(0, 500),
  };
}

/**
 * Convert NotionPageContent to TikTok-specific content format
 */
export function getTikTokContent(
  pageContent: NotionPageContent,
  config: NotionPagePostConfig
): TikTokContent {
  // Use platform-specific caption if available, otherwise use general text
  const caption = config.platformCaptions?.tiktok || pageContent.richText?.text || "";

  // Select thumbnail (for potential removal from media)
  const rawThumbnail = selectVideoThumbnail(pageContent, config);

  // Process media for TikTok platform and remove thumbnail if present
  const processedMedia = processMediaForPlatform<"file">(
    pageContent.media,
    "tiktok",
    rawThumbnail
  );

  return {
    description: replaceLineBreaksWithEmptySpaces(caption),
    media: processedMedia,
    title: pageContent.title,
  };
}

/**
 * Convert NotionPageContent to X/Twitter-specific content format
 */
export function getXContent(
  pageContent: NotionPageContent,
  config: NotionPagePostConfig,
  allowLongPosts: boolean = false
): XContent {
  const paragraphs = config.platformCaptions?.x
    ? getRichTextFromText(config.platformCaptions.x).paragraphs
    : pageContent.richText?.paragraphs;

  // Process media in paragraphs if available
  const processedParagraphs = processParagraphsMedia<"file">(
    paragraphs,
    "x",
    pageContent.media
  );

  const posts = getXContentFromParagraphs(processedParagraphs, allowLongPosts ? 25000 : 280);

  return posts;
}

/**
 * Convert NotionPageContent to Google My Business-specific content format
 */
export function getGmbContent(
  pageContent: NotionPageContent,
  config: NotionPagePostConfig
): GmbContent {
  // Use platform-specific caption if available, otherwise use general text
  const summary = config.captionText || config.titleText || "Check out our latest update!";

  // Limit summary to 1500 characters (GMB limit)
  const truncatedSummary =
    summary.length > 1500 ? summary.substring(0, 1497) + "..." : summary;

  // Process media for GMB platform
  const processedMedia = processMediaForPlatform<"file">(pageContent.media, "gmb");

  const content: GmbContent = {
    summary: truncatedSummary,
    media: processedMedia,
  };

  // Add title if available
  if (config.titleText && config.titleText !== config.captionText) {
    content.title = config.titleText;
  }

  // Add call to action if available
  if (config.ctaButton && config.ctaLink) {
    content.callToAction = {
      actionType: getGmbActionType(config.ctaButton),
      url: config.ctaLink,
    };
  }

  return content;
}

function getGmbActionType(
  ctaButton: string
): "BOOK" | "ORDER" | "SHOP" | "LEARN_MORE" | "SIGN_UP" | "CALL" {
  const button = ctaButton.toLowerCase();

  if (button.includes("book") || button.includes("reserve")) return "BOOK";
  if (button.includes("order") || button.includes("buy")) return "ORDER";
  if (button.includes("shop") || button.includes("store")) return "SHOP";
  if (button.includes("sign") || button.includes("register")) return "SIGN_UP";
  if (button.includes("call") || button.includes("phone")) return "CALL";

  return "LEARN_MORE";
}

/**
 * Helper function to determine Instagram post type based on media, rules and config
 *
 * @param media The media array from page content
 * @param config The Notion page post configuration
 * @returns The Instagram post type (reel, story, carousel, or image)
 */
export function determineInstagramPostType(
  media?: Array<Pick<Media, "type">>,
  config?: NotionPagePostConfig,
  isPaidUser?: boolean
): InstagramContent["postType"] {
  if (!media || media.length === 0) return "image";

  const rules = config?.rules || {};

  // Filter media by type
  const images = media.filter((m) => m.type === "image");
  const videos = media.filter((m) => m.type === "video");

  // Check rules for story and reel preferences
  const storyByRule = rules["in-story>feed"] || rules["story>feed"];
  const reelByRule = rules["in-reel>video"] || rules["reel>video"];

  // Determine post type based on rules and media content
  const isStory = storyByRule && isPaidUser;
  const singleVideo = videos.length === 1 && images.length === 0;
  const isReel = !isStory && (reelByRule || singleVideo);
  const isCarousel = !isReel && !isStory && media.length > 1;

  if (isStory) return "story";
  if (isReel) return "reel";
  if (isCarousel) return "carousel";

  return "image";
}
