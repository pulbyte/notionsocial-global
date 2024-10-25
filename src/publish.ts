import {getContentFromNotionBlocksAsync} from "./content";
import {formatBytesIntoReadable, hasText} from "./text";
import {
  AuthorUser,
  Content,
  NotionFiles,
  NotionPagePostConfig,
  MediaFile,
  UserData,
  Media,
  PostRecord,
  TMediaFile,
  MediaTransformation,
} from "./types";
import {callFunctionsSequentiallyBreak, callNestedFunctionsSequentially} from "./utils";
import {Client, iteratePaginatedAPI} from "@notionhq/client";
import {
  getMediaTransformations,
  getMediaFromNotionFiles,
  getMediaFile,
  getTransformedMediaFile,
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
import {filterPublishMedia, getContentTypeFromMimeType} from "./_media";
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

export function getNotionPageContent(config: NotionPagePostConfig): Promise<Content> {
  return new Promise(async (res, rej) => {
    try {
      let __: Content = {
        text: "",
        paragraphs: [],
        threads: [],
        altText: config.altText,
        twitter: [],
      };

      const notion = new Client({
        auth: config._data.access_token,
        timeoutMs: 15000,
      });

      // ** Caption from caption rich_text property
      if (hasText(config.captionText)) {
        const content = getContentFromTextProperty(config.captionText);
        Object.assign(__, content);
        res(__);
        return;
      }

      const iterateArr = iteratePaginatedAPI(notion.blocks.children.list, {
        block_id: config._pageId,
      });

      const content = await getContentFromNotionBlocksAsync(
        iterateArr,
        config.formattingOptions
      );
      Object.assign(__, content);

      // ** Caption from page title
      if (!hasText(content.text) && !content.hasMedia) {
        const content = getContentFromTextProperty(config.titleText);
        Object.assign(__, content);
      }

      return res(__);
    } catch (error) {
      rej(error);
    }
  });
}

export function getPropertyMedia(files: NotionFiles): Promise<Media[]> {
  let __ = [];

  return new Promise((res) => {
    getMediaFromNotionFiles(files)
      .then((media) => {
        if (media) {
          __ = filterPublishMedia(media);
          // __.forEach((file, index) => {
          //   const transformations = getMediaTransformations(file, postRecord);
          //   if (transformations) {
          //     Object.assign(__[index], {transformations});
          //   }
          // });
        }
        res(__);
      })
      .catch((e) => {
        return PublishError.create("error-getting-property-media", {cause: e});
      });
  });
}

export async function processMedia(
  propertyMediaArray: Media[],
  pageMediaListArray: Media[][],
  toDownload: Array<"video" | "image" | "doc">,
  processedMedia: PostRecord["processed_media"]
): Promise<[MediaFile[], MediaFile[][]]> {
  if (!propertyMediaArray && !pageMediaListArray) {
    return [[], []];
  }

  // Media processing functions
  async function fetchMedia(
    media: Media,
    transformations?: MediaTransformation[],
    fallback: boolean = false
  ): Promise<MediaFile | TMediaFile> {
    if (transformations && !fallback) {
      try {
        const tMediaFile = await getTransformedMediaFile(media, transformations);
        console.log("Transformed media -->", tMediaFile);
        return tMediaFile;
      } catch (error) {
        console.log("Error in getting transformed media", error);
        return await fetchMedia(media, [], true);
      }
    }

    return getMediaFile(media);
  }

  async function createEmptyBufferMedia(media: Media): Promise<MediaFile> {
    const bufferSize = 10;
    const emptyBuffer = Buffer.alloc(bufferSize);
    return Object.assign(media, {
      url: media.url,
      size: bufferSize,
      buffer: emptyBuffer,
      contentType: getContentTypeFromMimeType(media.mimeType),
    });
  }

  function getMediaFetcher(media: Media) {
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

    return toDownload?.includes(media.type)
      ? () => fetchMedia(media, transformations)
      : () => createEmptyBufferMedia(media);
  }

  const propertyMediaPromises = propertyMediaArray.map(getMediaFetcher);

  let filteredPropertyMediaResults = [];
  let filteredPageMediaResults = [];

  return callFunctionsSequentiallyBreak(propertyMediaPromises)
    .then((propertyMediaResults) => {
      filteredPropertyMediaResults = propertyMediaResults.filter(
        (media): media is MediaFile => media != null
      );
      return callNestedFunctionsSequentially(
        pageMediaListArray.map((list) => list.map(getMediaFetcher))
      );
    })
    .then((pageMediaResults) => {
      filteredPageMediaResults = pageMediaResults.map((tweetMedia) =>
        tweetMedia.filter((media): media is MediaFile => media != null)
      );

      return [filteredPropertyMediaResults, filteredPageMediaResults];
    });
}
export function getAuthor(uuid): Promise<{author: AuthorUser; user: UserData}> {
  let __: AuthorUser = {uuid};

  if (!uuid) return PublishError.reject("error-getting-author");
  return getUserDoc(uuid).then((doc) => {
    const user = doc.data as UserData;
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
          return PublishError.reject("post-monthy-limit-reached", {message: msg});
        } else if (!__.hasActiveSubscription) {
          const msg = `Inactive subscription, Please upgrade or pay existing bill due ${
            user.billing?.invoice_url ? " -> " + user.billing?.invoice_url : ""
          }`;
          return PublishError.reject("inactive-subscription", {message: msg});
        }
        return {author: __, user};
      });
  });
}
