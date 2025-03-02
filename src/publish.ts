import {getContentFromNotionBlocksAsync} from "./content";
import {formatBytesIntoReadable, hasText} from "./text";
import {
  AuthorUser,
  Content,
  NotionFiles,
  NotionPagePostConfig,
  UserData,
  Media,
  PostRecord,
  MediaTransformation,
  MediaType,
  SocialPlatformTypes,
  NotionBlock,
} from "./types";
import {callFunctionsSequentiallyBreak} from "./utils";
import {Client, iteratePaginatedAPI} from "@notionhq/client";
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
import {getContentFromTextProperty} from "./_content";
import {PublishError} from "./PublishError";

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

export function getNotionPageContent(
  config: NotionPagePostConfig
): Promise<[Content, NotionBlock[]]> {
  return new Promise(async (res, rej) => {
    try {
      let __: Content = {
        text: "",
        paragraphs: [],
        threads: [],
        bluesky: [],
        altText: config.altText,
        twitter: [],
      };

      const notion = new Client({
        auth: config._data.access_token,
        timeoutMs: 15000,
      });

      function getChildrenIterator(blockId: string) {
        const iterateArr = iteratePaginatedAPI(notion.blocks.children.list, {
          block_id: blockId,
        });
        return iterateArr;
      }

      // ** Caption from caption rich_text property
      if (hasText(config.captionText)) {
        const content = getContentFromTextProperty(config.captionText);
        Object.assign(__, content);
        res([__, []]);
        return;
      }

      const pageChildrenIterator = getChildrenIterator(config._pageId);

      const [content, blocks] = await getContentFromNotionBlocksAsync(
        pageChildrenIterator,
        config.formattingOptions,
        getChildrenIterator
      );
      Object.assign(__, content);

      // ** Caption from page title
      if (!hasText(content.text) && !content.hasMedia) {
        const content = getContentFromTextProperty(config.titleText);
        Object.assign(__, content);
      }

      return res([__, blocks]);
    } catch (error) {
      rej(error);
    }
  });
}

export async function getPropertyMedia(
  config: NotionPagePostConfig
): Promise<{media: Media[]; videoThumbnail: Media}> {
  try {
    const media = await getMediaFromNotionFiles(config.media).then((media) =>
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
  smAccPlatforms: SocialPlatformTypes[]
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
  typesToDownload: Array<"video" | "image" | "doc">,
  processedMedia: PostRecord["processed_media"]
) {
  // Media processing functions
  async function fetchMedia(
    media: Media,
    transformations?: MediaTransformation[],
    fallback: boolean = false
  ): Promise<MediaType> {
    // Check cache first
    if (media.refId && processedMediaCache.has(media.refId)) {
      return processedMediaCache.get(media.refId)!;
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

export async function processContentMedia(
  content: Content,
  typesToDownload: Array<"video" | "image" | "doc">,
  processedMedia: PostRecord["processed_media"]
): Promise<Content> {
  // Process main content media
  if (content.media) {
    content.media = await processMedia(content.media, typesToDownload, processedMedia);
  }

  if (content.videoThumbnail) {
    const processedThumbnails = await processMedia(
      [content.videoThumbnail],
      ["image"],
      processedMedia
    );
    content.videoThumbnail = processedThumbnails[0];
  }

  // Process Twitter media
  if (content.twitter) {
    for (const tweet of content.twitter) {
      if (tweet.media) {
        tweet.media = await processMedia(tweet.media, typesToDownload, processedMedia);
      }
    }
  }

  // Process Bluesky media
  if (content.bluesky) {
    for (const post of content.bluesky) {
      if (post.media) {
        post.media = await processMedia(post.media, typesToDownload, processedMedia);
      }
    }
  }

  processedMediaCache.clear();
  return content;
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
