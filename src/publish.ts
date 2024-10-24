import {getContentFromNotionBlocksAsync} from "./content";
import {hasText} from "./text";
import {
  AuthorUser,
  Content,
  FormattingOptions,
  NotionFiles,
  NotionPagePostConfig,
  PostRecord,
  PublishMedia,
  PublishMediaBuffer,
  User,
  UserData,
} from "./types";
import {callFunctionsSequentiallyBreak, callNestedFunctionsSequentially} from "./utils";
import {Client, iteratePaginatedAPI} from "@notionhq/client";
import {
  findOptimizedMedia,
  getMediaFromNotionFiles,
  getMediaFile,
  getOptimizedMedia,
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
import {filterPublishMedia} from "_media";
import {getContentFromTextProperty} from "_content";
import {PublishError} from "PublishError";

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

export function getPropertyMedia(
  files: NotionFiles,
  postRecord: PostRecord
): Promise<PublishMedia[]> {
  let __ = [];

  return new Promise((res) => {
    getMediaFromNotionFiles(files)
      .then((media) => {
        if (media) {
          __ = filterPublishMedia(media);
          __.forEach((file, index) => {
            const optzedMedia = findOptimizedMedia(file, postRecord);
            if (optzedMedia) {
              __[index].originalLink = __[index].url;
              __[index].url = optzedMedia.optimizedLink;
              __[index].optimization = optzedMedia.optimization;
              __[index].optimizedSize = optzedMedia.optimizedSize;
              console.log("Overwriten media url to optimized one: ", __[index]);
            }
          });
        }
        res(__);
      })
      .catch((e) => {
        return PublishError.create("error-getting-property-media", {cause: e});
      });
  });
}

export async function processMedia(
  propertyMediaArray: PublishMedia[],
  pageMediaListArray: PublishMedia[][],
  toDownload: Array<"video" | "image" | "doc">
): Promise<[PublishMediaBuffer[], PublishMediaBuffer[][]]> {
  if (!propertyMediaArray && !pageMediaListArray) {
    return [[], []];
  }

  function createMediaObject(
    original: PublishMedia | any,
    updates: Partial<PublishMediaBuffer>
  ): PublishMediaBuffer {
    return {...original, ...updates};
  }

  // Media processing functions
  async function fetchMedia(
    file: PublishMedia,
    fallback: boolean = false
  ): Promise<PublishMediaBuffer> {
    if (file.optimization && !fallback) {
      try {
        const result = await getOptimizedMedia(
          file.mediaRef,
          file.optimizedSize,
          file.mimeType
        );
        console.log("Optimized media -->", result);
        return createMediaObject(file, {...result, url: file.url});
      } catch (error) {
        console.log("Error in getting optimized media", error);
        return await fetchMedia(file, true);
      }
    }

    file.url = file.originalLink || file.url;
    return getMediaFile(file).then((result) => createMediaObject(file, result));
  }

  async function getEmptyBufferMedia(file: PublishMedia): Promise<PublishMediaBuffer> {
    const bufferSize = 10;
    const emptyBuffer = Buffer.alloc(bufferSize);
    return createMediaObject(file, {
      url: file.url,
      size: bufferSize,
      buffer: emptyBuffer,
    });
  }

  function getMediaFetcher(file: PublishMedia) {
    const Type = file.type ? String(file.type).toUpperCase() : "Media file";
    if (file.size > maxMediaSize.bytes) {
      throw new Error(
        `${Type} exceeds ${maxMediaSize.MB} MB size limit. Please reduce the file size by compressing or lowering quality, then upload again.`
      );
    }
    return toDownload?.includes(file.type)
      ? () => fetchMedia(file)
      : () => getEmptyBufferMedia(file);
  }

  const propertyMediaPromises = propertyMediaArray.map(getMediaFetcher);

  let filteredPropertyMediaResults = [];
  let filteredPageMediaResults = [];

  return callFunctionsSequentiallyBreak(propertyMediaPromises)
    .then((propertyMediaResults) => {
      filteredPropertyMediaResults = propertyMediaResults.filter(
        (media): media is PublishMediaBuffer => media != null
      );
      return callNestedFunctionsSequentially(
        pageMediaListArray.map((list) => list.map(getMediaFetcher))
      );
    })
    .then((pageMediaResults) => {
      filteredPageMediaResults = pageMediaResults.map((tweetMedia) =>
        tweetMedia.filter((media): media is PublishMediaBuffer => media != null)
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
