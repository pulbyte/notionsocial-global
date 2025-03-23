import lodash from "lodash";
import {
  NotionFiles,
  NotionMultiSelectProperty,
  NotionPage,
  NotionPagePostConfig,
  NotionPagePropertiesForPost,
  PostRecord,
  Media,
  UserData,
  SocialPlatformTypes,
  NotionDatabase,
} from "./types";
import {hasText, notionRichTextParser, processInstagramTags} from "./text";
import {isAnyValueInArray} from "./utils";
import {parseNotionRule} from "./_notion";
import {
  binaryUploadSocialPlatforms,
  filterPublishMedia,
  getStaticMediaFromNotionFile,
} from "./_media";
import {PublishError} from "./PublishError";
import _ from "lodash";
import {getReadableTimeByTimeZone} from "time";
import {dev} from "env";

export function getNotionPageConfig(
  notionPage: NotionPage,
  notionDatabaseData: NotionDatabase,
  postRecord?: PostRecord,
  authorRecord?: UserData
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
    youtubePrivacyStatusProp: null,
    videoThumbnailProp: null,
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
    properties[notionDatabaseData.options?.pinterest_board_prop || "Pinterest - Board"];

  _props.altTextProp = properties[notionDatabaseData.props?.alt_text || "Alt Text"];

  _props.imageUserTagsProp = properties[notionDatabaseData.options?.["image_user_tags_prop"]];

  _props.collaboratorTagsProp =
    properties[notionDatabaseData.options?.["collaborator_tags_prop"]];

  _props.locationTagsProp = properties[notionDatabaseData.options?.["location_tag_prop"]];

  _props.youtubePrivacyStatusProp =
    properties[notionDatabaseData.options?.["youtube_privacy_status_prop"]];

  _props.videoThumbnailProp =
    properties[notionDatabaseData.options?.video_thumbnail_image_prop];

  let __: NotionPagePostConfig = {
    _pageId: notionPage.id,
    _props,
    _data: notionDatabaseData,
    _properties: properties,
    nsFilter: null,
    titleText: "",
    captionText: "",
    commentText: "",
    schTime: {
      rawStr: null,
      fmtTz: null,
      epochMs: null,
      date: null,
    },
    status: null,
    videoThumbnail: [],
    media: [],
    pinterestBoardOption: null,
    altText: "",
    imageUserTags: [],
    collaboratorTags: [],
    locationTag: null,
    youtubePrivacyStatus: null,
    smAccs: [],
    smAccsPlatforms: [],
    rules: {},
    filesToDownload: [],
    formattingOptions: {},
    isPostReadyToSchedule: false,
    archived: null,
  };
  __.archived = notionPage["archived"];
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
    nsProp,
    youtubePrivacyStatusProp,
    videoThumbnailProp,
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
  const time = schTimeProp?.["date"]?.["start"];
  const date = new Date(time);
  if (time) {
    __.schTime = {
      rawStr: time,
      fmtTz: getReadableTimeByTimeZone(time),
      epochMs: date.getTime(),
      date,
    };
  }
  __.media = mediaProp?.["files"];

  __.videoThumbnail = videoThumbnailProp?.["files"];

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

  const ytPrivacyStatus = youtubePrivacyStatusProp?.select?.name?.toLowerCase();
  __.youtubePrivacyStatus = ytPrivacyStatus?.includes("private")
    ? "private"
    : ytPrivacyStatus?.includes("unlisted")
    ? "unlisted"
    : "public";

  const smAccs = getSelectedSocialAccounts(smAccsProp, notionDatabaseData, postRecord);
  __.smAccs = smAccs;

  __.smAccsPlatforms = _.uniq(smAccs.map((acc) => acc.platform));

  // ? Post Rules
  const ruleMap = notionDatabaseData?.["rules"];
  if (ruleMap && typeof ruleMap == "object") {
    Object.entries(ruleMap).forEach(([ruleCode, filter]) => {
      const filterResult = parseNotionRule(filter, properties);
      __.rules[ruleCode] = filterResult;
    });
  }
  const smAccPlatforms = smAccs.map((acc) => acc.platform);
  const toDownload = isAnyValueInArray(binaryUploadSocialPlatforms, smAccPlatforms);
  const hasPinterest = smAccPlatforms?.includes("pinterest");
  const hasFacebook = smAccPlatforms?.includes("facebook");

  __.filesToDownload = [];

  if (toDownload) __.filesToDownload = ["video", "image", "doc"];
  // ? Pinterest needs video in buffer
  if (hasPinterest) __.filesToDownload.push("video");
  // ? Facebook needs image in buffer for the video's cover image
  if (hasFacebook) __.filesToDownload.push("image");

  __.filesToDownload = _.uniq(__.filesToDownload);

  const nsText = notionRichTextParser(nsProp?.["rich_text"], true);

  // ** Check if post is ready to be scheduled
  const isStatusDone = __.nsFilter == __.status;
  const isNsPropertyEmpty = !hasText(nsText);
  const hasSelectPlatform = __.smAccs?.length > 0;
  const isScheduledWithin30Days = __.schTime?.epochMs
    ? (__.schTime.epochMs - Date.now()) / (1000 * 60 * 60 * 24) <= 30
    : true;

  const isPostReadyToSchedule =
    isStatusDone &&
    isNsPropertyEmpty &&
    hasSelectPlatform &&
    isScheduledWithin30Days &&
    !__.archived;
  __.isPostReadyToSchedule = isPostReadyToSchedule;

  __.formattingOptions = {
    addLineBreakOnParagraphBlock:
      notionDatabaseData.formatting_options?.add_line_break_on_paragraph_block ||
      authorRecord?.ndb_settings?.formatting_options?.add_line_break_on_paragraph_block,
    disableTextFormatting:
      notionDatabaseData.formatting_options?.disable_text_formatting ||
      authorRecord?.ndb_settings?.formatting_options?.disable_text_formatting,
  };
  return __;
}

export function examinePostConfig(config: NotionPagePostConfig, disallowPostponing: boolean) {
  const statusValue = config?.status?.toLowerCase();
  const isStatusDone =
    config?.nsFilter && config?.status && statusValue == config?.nsFilter?.toLowerCase();
  const schStatus = config?._data?.publish_changes?.schedule_status;
  const isStatusScheduled = schStatus && statusValue == schStatus?.toLowerCase();
  const time = config?.schTime?.epochMs;

  if (config?.archived) {
    console.warn(`Post is archived [${config?._pageId}]`);
    // return PublishError.reject("notion-page-deleted");
  }

  // ? If the post is scheduled to be published in the future, reject the post
  // Check if the post is updated to publish in the next 5 minutes
  if (!disallowPostponing && time && time > Date.now() + (dev ? 0 : 60_000 * 5)) {
    return PublishError.reject("post-postponed");
  } else if (!isStatusDone && !isStatusScheduled) {
    return PublishError.reject("post-cancelled");
  }

  if (config?.smAccs?.length == 0) {
    return PublishError.reject("no-social-account-selected");
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
  userRecord?: UserData,
  disallowPostponing?: boolean
): Promise<NotionPagePostConfig> {
  const config = getNotionPageConfig(ndbPage, ndbData, postRecord, userRecord);
  // if (noExamine) return Promise.resolve(config);
  return examinePostConfig(config, disallowPostponing);
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

export function getPropertyMediaStatic(
  files: NotionFiles,
  smAccPlatforms: SocialPlatformTypes[]
): Media[] {
  return filterPublishMedia(files.map(getStaticMediaFromNotionFile), smAccPlatforms);
}
