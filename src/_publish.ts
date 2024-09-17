import lodash from "lodash";
import {
  NotionDatabase,
  NotionFiles,
  NotionMultiSelectProperty,
  NotionPage,
  NotionPagePostConfig,
  NotionPagePropertiesForPost,
  NotionRuleCode,
  PostRecord,
  PublishMedia,
} from "./types";
import {notionRichTextParser, processInstagramTags} from "text";
import {getDate, isAnyValueInArray} from "utils";
import {parseNotionRule} from "./_notion";
import {
  binaryUploadSocialPlatforms,
  filterPublishMedia,
  getStaticMediaFromNotionFile,
} from "_media";
import {PublishError} from "./PublishError";

export function getNotionPageConfig(
  notionPage: NotionPage,
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
  __.smAccs = smAccs;

  // ? Post Rules
  const ruleMap = notionDatabaseData?.["rules"];
  if (ruleMap && typeof ruleMap == "object") {
    Object.keys(ruleMap).forEach((ruleCode: NotionRuleCode) => {
      const filter = ruleMap[ruleCode];
      const filterResult = parseNotionRule(filter, properties);
      __.rules[ruleCode] = filterResult;
    });
  }
  const smAccPlatforms = smAccs.map((acc) => acc.platform);
  const toDownload = isAnyValueInArray(binaryUploadSocialPlatforms, smAccPlatforms);
  const hasPinterest = smAccPlatforms?.includes("pinterest");
  const hasFacebook = smAccPlatforms?.includes("facebook");
  __.filesToDownload = toDownload
    ? ["video", "image", "doc"]
    : hasPinterest
    ? // ? Cause pinterest needs video in buffer
      ["video"]
    : hasFacebook
    ? // ? Cause Facebook needs buffer image for the video's cover image
      ["image"]
    : [];

  return __;
}

export function examinePostConfig(queueEta?: number, config?: NotionPagePostConfig) {
  const allowdStatus = [config?.nsFilter, config?._data?.publish_changes?.schedule_status];

  if (config?.schTime > queueEta) {
    return PublishError.reject("post-postponed");
  } else if (!allowdStatus.includes(config?.status)) {
    return PublishError.reject("post-cancelled");
  }
  return Promise.resolve(config);
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
  time?: number,
  noExamine?: boolean
): Promise<NotionPagePostConfig> {
  const config = getNotionPageConfig(ndbPage, ndbData, postRecord);
  if (noExamine) return Promise.resolve(config);
  else return examinePostConfig(time, config);
}

function getSelectedSocialAccounts(
  smAccsProp: NotionMultiSelectProperty,
  notionDatabaseData: NotionDatabase,
  postRecord?: PostRecord
) {
  const smAccTags: Array<string> = smAccsProp?.multi_select?.map((prop) => prop.name);
  const smAccs: NotionDatabase["sm_accs"] = smAccTags
    .map((tag) => {
      return lodash.find(notionDatabaseData["sm_accs"], {tag});
    })
    .filter((acc) => acc != null)
    .filter((acc) => {
      // ? Filter out the accounts, If post has already been published in previous attempts.
      const previousPlatformData = postRecord?.platforms?.[acc.platform_uid];

      const hadServerError = previousPlatformData?.isServerError == true;
      const alreadyCompleted =
        previousPlatformData?.completed == true ||
        !!previousPlatformData?.response ||
        !!previousPlatformData?.error;
      const toAttempt = hadServerError || !alreadyCompleted;

      if (!toAttempt) {
        console.log(
          `Skipping `,
          acc.platform_uid,
          ` As it's already completed `,
          previousPlatformData
        );
      }

      return toAttempt;
    });
  return smAccs;
}

export function getPropertyMediaStatic(files: NotionFiles): PublishMedia[] {
  return filterPublishMedia(files.map(getStaticMediaFromNotionFile));
}