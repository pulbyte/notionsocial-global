import lodash from "lodash";
import {GetPageResponse} from "@notionhq/client/build/src/api-endpoints";
import {getContentFromNotionBlocksAsync, getContentFromTextProperty} from "content";
import {hasText, notionRichTextParser, processInstagramTags} from "text";
import {
  AuthorUser,
  Content,
  NotionDatabase,
  NotionFiles,
  NotionMultiSelectProperty,
  NotionPage,
  NotionPagePostConfig,
  NotionPagePropertiesForPost,
  NotionRuleCode,
  PostRecord,
  PublishMedia,
  PublishMediaBuffer,
  SocialPlatformTypes,
  User,
} from "types";
import {
  callFunctionsSequentiallyBreak,
  callNestedFunctionsSequentially,
  getDate,
  isAnyValueInArray,
} from "utils";
import {Client, iteratePaginatedAPI} from "@notionhq/client";
import {parseNotionRule} from "notion";
import {PublishError} from "error";
import {
  binaryUploadSocialPlatforms,
  filterPublishMedia,
  findOptimizedMedia,
  getMediaFromNotionFiles,
  getMediaFile,
  getOptimizedMedia,
} from "media";
import {getUserDoc, getUserPostCount} from "data";
import {PRICING_PLANS, freeMonthlyPostLimit, isPlanPaid, isSubscriptionActive} from "pricing";
import {auth} from "firebase-admin";
import {dev} from "env";

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

export function getNotionPageConfig(
  notionPage: GetPageResponse,
  notionDatabaseData: NotionDatabase,
  postRecord?: PostRecord
): NotionPagePostConfig {
  const properties = notionPage["properties"];

  let _props: NotionPagePropertiesForPost = {
    titleProp: null,
    nsProp: null,
    commentProp: null,
    captionProp: null,
    smAccsProp: null,
    schTimeProp: null,
    statusProp: null,
    mediaProp: null,
    pinterestBoardProp: null,
    altTextProp: null,
    imageUserTagsProp: null,
    collaboratorTagsProp: null,
    locationTagsProp: null,
  };

  const titlePropName = Object.keys(properties).find(
    (key) => properties[key]["type"] == "title"
  );

  _props.titleProp = properties[titlePropName];
  _props.nsProp = properties[notionDatabaseData.props["ns"]];
  _props.smAccsProp = properties[notionDatabaseData.props["sm_accs"]];
  _props.schTimeProp = properties[notionDatabaseData.props["sch_time"]];
  _props.statusProp = properties[notionDatabaseData.props["status"]];
  _props.mediaProp = properties[notionDatabaseData.props["media"]];

  _props.captionProp = properties[notionDatabaseData.props["caption"]];

  _props.commentProp = properties[notionDatabaseData.publish_changes?.["first_comment_prop"]];

  _props.pinterestBoardProp =
    properties[notionDatabaseData.platforms?.pinterest?.board_prop || "Pinterest - Board"];

  _props.altTextProp = properties[notionDatabaseData.props?.alt_text || "Alt Text"];

  _props.imageUserTagsProp = properties[notionDatabaseData.options?.["image_user_tags_prop"]];

  _props.collaboratorTagsProp =
    properties[notionDatabaseData.options?.["collaborator_tags_prop"]];

  _props.locationTagsProp = properties[notionDatabaseData.options?.["location_tag_prop"]];

  let __: NotionPagePostConfig = {
    _pageId: notionPage.id,
    _props,
    _data: notionDatabaseData,
    _properties: properties,
    nsFilter: null,
    titleText: "",
    captionText: "",
    commentText: "",
    schTime: null,
    status: null,
    media: [],
    pinterestBoardOption: null,
    altText: "",
    imageUserTags: [],
    collaboratorTags: [],
    locationTag: null,
    smAccIds: [],
    smAccPlatforms: [],
    smAccs: [],
    rules: {},
    filesToDownload: [],
  };
  const {
    commentProp,
    captionProp,
    schTimeProp,
    smAccsProp,
    statusProp,
    mediaProp,
    pinterestBoardProp,
    altTextProp,
    locationTagsProp,
    imageUserTagsProp,
    collaboratorTagsProp,
    titleProp,
  } = _props;
  __.nsFilter = notionDatabaseData["ns_filter"];
  if (commentProp?.type == "rich_text") {
    __.commentText = notionRichTextParser(commentProp?.["rich_text"]);
  } else if (commentProp?.type == "formula") {
    __.commentText = commentProp?.["formula"]?.["string"];
  }

  __.titleText = notionRichTextParser(titleProp?.["title"], true);

  if (captionProp?.type == "rich_text") {
    __.captionText = notionRichTextParser(captionProp?.["rich_text"]);
  } else if (captionProp?.type == "formula") {
    __.captionText = captionProp?.["formula"]?.["string"];
  }
  __.schTime = getDate(schTimeProp?.["date"]?.["start"]);
  __.media = mediaProp?.["files"];

  __.status = statusProp?.["select"]?.["name"];

  __.pinterestBoardOption = pinterestBoardProp?.select;

  __.altText = notionRichTextParser(altTextProp?.["rich_text"], true);

  __.imageUserTags = processInstagramTags(
    imageUserTagsProp?.multi_select?.map((prop) => prop.name)
  );

  __.collaboratorTags = processInstagramTags(
    collaboratorTagsProp?.multi_select?.map((prop) => prop.name)
  )?.slice(0, 3);

  __.locationTag = locationTagsProp?.select?.name;

  const smAccs = getSelectedSocialAccounts(smAccsProp, notionDatabaseData, postRecord);
  Object.assign(__, smAccs);

  // ? Post Rules
  const ruleMap = notionDatabaseData?.["rules"];
  if (ruleMap && typeof ruleMap == "object") {
    Object.keys(ruleMap).forEach((ruleCode: NotionRuleCode) => {
      const filter = ruleMap[ruleCode];
      const filterResult = parseNotionRule(filter, properties);
      __.rules[ruleCode] = filterResult;
    });
  }
  const toDownload = isAnyValueInArray(binaryUploadSocialPlatforms, smAccs.smAccPlatforms);
  const hasPinterest = smAccs.smAccPlatforms?.includes("pinterest");

  __.filesToDownload = toDownload ? ["video", "image", "doc"] : hasPinterest ? ["video"] : [];

  return __;
}

export function getNotionPageContent(config: NotionPagePostConfig): Promise<Content> {
  return new Promise(async (res, rej) => {
    try {
      let __: Content = {
        text: "",
        paragraphs: [""],
        thread: [],
        altText: config.altText,
        tweetExceededCharLimit: false,
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
      const content = await getContentFromNotionBlocksAsync(iterateArr);
      Object.assign(__, content);

      // ** Caption from page title
      if (!hasText(content.text)) {
        const content = getContentFromTextProperty(config.titleText);
        Object.assign(__, content);
      }

      return res(__);
    } catch (error) {
      rej(error);
    }
  });
}

export function examinePostConfig(queueEta: number, config?: NotionPagePostConfig) {
  const allowdStatus = [config?.nsFilter, config?._data?.publish_changes?.schedule_status];
  if (dev) console.log("allowdStatus", allowdStatus);
  if (config?.schTime > queueEta) {
    return PublishError.reject("post-postponed");
  } else if (!allowdStatus.includes(config?.status)) {
    return PublishError.reject("post-cancelled");
  }
  return Promise.resolve(config);
}

function getSelectedSocialAccounts(
  smAccsProp: NotionMultiSelectProperty,
  notionDatabaseData: NotionDatabase,
  postRecord?: PostRecord
) {
  const smAccTags: Array<string> = smAccsProp?.multi_select?.map((prop) => prop.name);
  const smAccs = smAccTags
    .map((tag) => {
      return lodash.find(notionDatabaseData["sm_accs"], {tag});
    })
    .filter((smAcc) => {
      return smAcc != null;
    });
  const smAccIds = smAccs
    .map((acc) => acc.platform_uid)
    .filter((pid) => {
      // ? Filter out the accounts, If post has already been published in previous attempts.
      const previousPlatformData = postRecord?.platforms?.[pid];

      const hadServerError = previousPlatformData?.isServerError == true;
      const alreadyCompleted =
        previousPlatformData?.completed == true ||
        !!previousPlatformData?.response ||
        !!previousPlatformData?.error;
      const toAttempt = hadServerError || !alreadyCompleted;

      if (!toAttempt) {
        console.log(`Skipping `, pid, ` As it's already completed `, previousPlatformData);
      }

      return toAttempt;
    });
  const smAccPlatforms = smAccs.map((acc) => acc.platform);

  return {
    smAccIds,
    smAccs,
    smAccPlatforms,
  };
}
export function examineNdb(data: NotionDatabase): Promise<NotionDatabase> {
  return new Promise((res, rej) => {
    if (!data) return rej(PublishError.create("notion-database-deleted"));
    const {state} = data;
    const disconnected = !state || !["active", "dev-active"].includes(state);
    if (data["locked"]) {
      return rej(PublishError.create("notion-database-locked"));
    } else if (disconnected) {
      return rej(PublishError.create("notion-database-disconnected"));
    } else res(data);
  });
}

export function getPostConfig(
  ndbPage: NotionPage,
  ndbData: NotionDatabase,
  postRecord: PostRecord,
  time: number,
  noExamine?: boolean
): Promise<NotionPagePostConfig> {
  const config = getNotionPageConfig(ndbPage, ndbData, postRecord);
  if (noExamine) return Promise.resolve(config);
  else return examinePostConfig(time, config);
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
export function getAuthor(uuid): Promise<AuthorUser> {
  let __: AuthorUser = {uuid};

  if (!uuid) return PublishError.reject("error-getting-author");
  return getUserDoc(uuid).then((doc) => {
    const user = doc.data as User;
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
        return __;
      });
  });
}
