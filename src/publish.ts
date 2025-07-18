import {getRichTextContent, processRichTextContentMedia} from "./content";
import {formatBytesIntoReadable} from "./text";
import {
  AuthorUser,
  NotionPageContent,
  NotionFiles,
  NotionPagePostConfig,
  UserData,
  Media,
  PostRecord,
  MediaTransformation,
  MediaType,
} from "./types";
import {callFunctionsSequentiallyBreak} from "./utils";
import {
  getMediaTransformations,
  getMediaFromNotionFiles,
  getMediaFile,
  getTransformedMedia,
} from "./media";
import {getUserDoc, getUserPostCount} from "./data";
import {
  PRICING_PLANS,
  freeMonthlyPostLimit,
  isPlanPaid,
  isSubscriptionActive,
} from "./pricing";
import {auth} from "firebase-admin";
import {maxMediaSize} from "./env";
import {filterPublishMedia} from "./_media";
import {PublishError} from "./PublishError";
import {SocialPlatformType} from "@pulbyte/social-stack-lib";
import {dog} from "./logging";
export const postPublishStages = [
  "get-ndb-data",
  "examine-ndb-data",
  "get-post-record",
  "examine-post-record",
  "get-author",
  "get-ndb-page",
  "get-post-config",
  "examine-post-config",
  "get-page-content",
  "get-property-media",
  "process-media",
  "publish",
  "update-post-record",
  "update-ns-status",
  "update-status-property",
  "enqueue-first-comment-task",
] as const;
export const publishStageIndex = postPublishStages.indexOf("publish");

/**
 * Retrieves and processes Notion page content for publishing.
 * This function handles media processing, caption extraction, and content assembly.
 *
 * @param config - Configuration object containing page settings and post record data
 * @returns Promise resolving to processed page content and blocks
 */
export async function processPropertyMedia(
  media: Media[],
  videoThumbnail: Media,
  config: NotionPagePostConfig
): Promise<{media: Media[]; videoThumbnail: Media}> {
  // Process main media files with specified download types
  media = await processMedia(
    media,
    config.filesToDownload,
    config._postRecord?.processed_media
  );

  // Process video thumbnail if present
  if (videoThumbnail) {
    const processedThumbnails = await processMedia(
      [videoThumbnail],
      ["image"],
      config._postRecord?.processed_media
    );
    videoThumbnail = processedThumbnails[0];
  }

  return {media, videoThumbnail};
}

export async function getNotionPageContent(
  config: NotionPagePostConfig
): Promise<NotionPageContent> {
  let richText = await getRichTextContent(config);
  let {media, videoThumbnail} = await getPropertyMedia(config);

  // Step 1: Process main media files
  const {media: processedMedia, videoThumbnail: processedVideoThumbnail} =
    await processPropertyMedia(media, videoThumbnail, config);
  media = processedMedia;
  videoThumbnail = processedVideoThumbnail;

  // Step 2: Process rich text caption content
  richText = await processRichTextContentMedia(richText, config);

  // Step 3: Assemble final content object
  return {
    richText,
    title: config.titleText,
    media,
    videoThumbnail,
    altText: config.altText,
  };
}

export async function getPropertyMedia(
  config: NotionPagePostConfig
): Promise<{media: Media[]; videoThumbnail: Media}> {
  try {
    const media = await getMediaFromNotionFiles(config.media, config.altTextArr).then(
      (media) =>
        filterPublishMedia(
          media,
          config.smAccs.map((acc) => acc.platform)
        )
    );
    const videoThumbnail = await getMediaFromNotionFiles(config.videoThumbnail).then(
      (media) => {
        const filtered = filterPublishMedia(
          media,
          config.smAccs.map((acc) => acc.platform),
          "image"
        );
        return filtered[0];
      }
    );
    return {media, videoThumbnail};
  } catch (error) {
    throw PublishError.create("error-getting-property-media", {cause: error});
  }
}

export function getMediaFromNotionProperty(
  files: NotionFiles,
  smAccPlatforms: SocialPlatformType[]
): Promise<Media[]> {
  return getMediaFromNotionFiles(files)
    .then((media) => filterPublishMedia(media, smAccPlatforms))
    .catch((e) => {
      throw PublishError.create("error-getting-property-media", {cause: e});
    });
}

// Cache to store processed media by ref
const processedMediaCache: Map<string, MediaType> = new Map();

export function processMedia(
  media: Media[],
  typesToDownload?: Array<"video" | "image" | "doc">,
  processedMedia?: PostRecord["processed_media"]
) {
  // Media processing functions
  async function fetchMedia(
    media: Media,
    transformations?: MediaTransformation[],
    fallback: boolean = false
  ): Promise<MediaType> {
    // Check cache first
    if (media.refId && processedMediaCache.has(media.refId)) {
      const cachedMedia = processedMediaCache.get(media.refId);
      dog("Media from cache -->", cachedMedia);
      return cachedMedia;
    }

    const toDownload = typesToDownload?.includes(media.type);
    if (transformations && transformations.length > 0 && !fallback) {
      try {
        const tMediaFile = await getTransformedMedia(media, transformations, toDownload);
        // Cache the result
        if (media.refId) {
          processedMediaCache.set(media.refId, tMediaFile);
        }
        console.log("Transformed media -->", tMediaFile);
        return tMediaFile;
      } catch (error) {
        console.log(
          "Getting the original media, Due to error in downloading transformed media:",
          error
        );
        return await fetchMedia(media, [], true);
      }
    }
    if (!toDownload) return media;
    const result = await getMediaFile(media);
    // Cache the result
    if (media.refId) {
      processedMediaCache.set(media.refId, result);
    }
    return result;
  }

  function getMediaFetcher(media: Media) {
    // Check cache first
    if (media.refId && processedMediaCache.has(media.refId)) {
      dog("Media hit from cache -->", media.refId);
      return () => Promise.resolve(processedMediaCache.get(media.refId)!);
    }

    const transformations = getMediaTransformations(media, processedMedia);
    const isTransformed = transformations && transformations.length > 0;
    const Type = media.type ? String(media.type).toUpperCase() : "Media file";

    if (isTransformed) {
      for (const transformation of transformations) {
        if (transformation.metadata.size > maxMediaSize.bytes) {
          throw new Error(
            `${Type} still exceeds ${
              maxMediaSize.MB
            } MB size limit. We tried to compress it from ${formatBytesIntoReadable(
              media.size
            )} to ${formatBytesIntoReadable(
              transformation.metadata.size
            )}, but it's still too large. Please reduce the file size further and try again.`
          );
        }
      }
    } else if (media.size > maxMediaSize.bytes) {
      throw new Error(
        `${Type} exceeds ${maxMediaSize.MB} MB size limit. Please reduce the file size by compressing or lowering quality, then upload again.`
      );
    }
    return () => fetchMedia(media, transformations);
  }

  return callFunctionsSequentiallyBreak<MediaType>(media.map(getMediaFetcher)).then(
    (taskResults: MediaType[]) => {
      const results = taskResults.filter(Boolean);
      return results;
    }
  );
}

export function getAuthor(
  uuid,
  noReject?: boolean
): Promise<{author: AuthorUser; user: UserData; canPost: boolean}> {
  let __: AuthorUser = {uuid};

  if (!uuid) return PublishError.reject("error-getting-author");
  return getUserDoc(uuid).then((doc) => {
    const user = doc.data as UserData;

    let canPost = true;
    __.hasActiveSubscription = isSubscriptionActive(user.billing?.status);
    __.hasPaidSubscription = isPlanPaid(user.billing?.plan_id);

    return auth()
      .getUser(uuid)
      .then(({email}) => {
        __.email = email;
        return getUserPostCount(uuid);
      })
      .then((postCount) => {
        const plan = PRICING_PLANS[user.billing?.plan_id];

        __.monthPostCount = postCount;
        __.hasPaidSubscription = isPlanPaid(user.billing?.plan_id);
        __.reachedFreePostsQuota =
          !__.hasPaidSubscription && postCount >= freeMonthlyPostLimit + 2;
        __.plan = plan;

        if (__.reachedFreePostsQuota) {
          const msg = `You've reached your monthly limit of ${freeMonthlyPostLimit} posts for free accounts. Upgrade to a paid plan to post unlimited times.`;
          canPost = false;
          if (!noReject) {
            return PublishError.reject("post-monthy-limit-reached", {message: msg});
          }
        } else if (!__.hasActiveSubscription) {
          const msg = `Inactive subscription, Please upgrade or pay existing bill due ${
            user.billing?.invoice_url ? " -> " + user.billing?.invoice_url : ""
          }`;
          canPost = false;
          if (!noReject) {
            return PublishError.reject("inactive-subscription", {message: msg});
          }
        }
        return {author: __, user, canPost};
      });
  });
}
