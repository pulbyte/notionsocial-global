import {PRICING_PLAN_ID, PricingPlan} from "./pricing";
import {
  CheckboxPropertyItemObjectResponse,
  DatePropertyItemObjectResponse,
  EmailPropertyItemObjectResponse,
  FilesPropertyItemObjectResponse,
  GetPageResponse,
  MultiSelectPropertyItemObjectResponse,
  NumberedListItemBlockObjectResponse,
  PhoneNumberPropertyItemObjectResponse,
  FormulaPropertyItemObjectResponse,
  RichTextPropertyItemObjectResponse,
  SelectPropertyItemObjectResponse,
  StatusPropertyItemObjectResponse,
  TextRichTextItemResponse,
  TitlePropertyItemObjectResponse,
  UrlPropertyItemObjectResponse,
  BlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {firestore} from "firebase-admin";
import {postPublishStages} from "./publish";

// Notion File, Which is extracted from Notion
export interface Media {
  name: string;
  url: string;
  caption?: string;
  mimeType: string;
  contentType: string;
  size: number;
  type: "video" | "image" | "doc";
  refId: string;
}
// Media, Which is downloaded.
export interface MediaFile extends Media {
  buffer: Buffer;
  size: number;
}

export type TMediaTransformation = Omit<MediaTransformation, "src"> & {
  buffer?: Buffer;
  url: string;
};

export type TMedia = Media & {
  transformations: Array<TMediaTransformation>;
};

export type MediaType = Media | MediaFile | TMedia;

export type MediaMetadata = {
  size: number;
  height: number;
  width: number;
};
export type MediaCompression = "lossy" | "lossless";
export type MediaOrientation = "vertical" | "original";

export interface MediaTransformation {
  metadata: MediaMetadata;
  compression: MediaCompression;
  orientation: MediaOrientation;
  src: MediaSrc;
}

export interface BufferSrc {
  type: "buffer";
  buffer: Buffer;
}
export interface UrlSrc {
  type: "url";
  url: string;
}
export interface BucketSrc {
  type: "bucket";
  path: string;
}
export type MediaSrc = BufferSrc | UrlSrc | BucketSrc;

export interface MetricPropertyConfig {
  prop: string;
  prop_id?: string;
  separate_props?: {
    prop: string;
    prop_id?: string;
    platform: SocialPlatformTypes;
  }[];
  method: "aggregate" | "separate";
}
export interface NotionDatabase {
  uid: string;
  link_id: string;
  author_uid: string;
  locked?: boolean;
  ns_filter: string;
  state: "expired" | "unsynced" | "deleted" | "active";
  props: {
    media: string;
    sch_time: string;
    sm_accs: string;
    ns: string;
    status: string;
    alt_text?: string;
    caption?: string;
  };
  post_metric_tracking?: {
    platforms: SocialPlatformTypes[];
    likes?: MetricPropertyConfig;
    comments?: MetricPropertyConfig;
    shares?: MetricPropertyConfig;
    views?: MetricPropertyConfig;
    retweets?: MetricPropertyConfig;
    reposts?: MetricPropertyConfig;
    profile_visits?: MetricPropertyConfig;
    new_followers?: MetricPropertyConfig;
    saves?: MetricPropertyConfig;
  };
  stat_props?: {
    likes?: string;
    comments?: string;
    shares?: string;
    views?: string;
    retweets?: string;
    reposts?: string;
  };
  rules?: {[name: string]: any};
  platforms: any;
  access_token: string;
  sm_accs?: {
    platform_uid: string;
    tag: string;
    username: string;
    platform: SocialPlatformTypes;
  }[];
  url: string;
  int_secret: string;
  name: string;
  publish_changes?: {
    post_url_prop?: string;
    publish_status?: string;
    schedule_status?: string;
    first_comment_prop?: string;
  };
  options?: PostOptionsSchema;
  formatting_options?: {
    add_line_break_on_paragraph_block?: boolean;
    disable_text_formatting?: boolean;
  };
}

export type PostType =
  | "text"
  | "reel"
  | "story"
  | "carousel"
  | "image"
  | "video"
  | "document"
  | "long-tweet"
  | "thread";
export interface PlatformPublishResponse extends Partial<PlatformError> {
  response?: any;
  postType?: PostType;
}
export interface PostOptionsSchema {
  "tweet-cross-limit-action": "split-thread" | "throw-error" | "long-tweet";
  image_user_tags_prop: string;
  collaborator_tags_prop: string;
  location_tag_prop: string;
  youtube_privacy_status_prop: string;
}
export interface UserData {
  uid: string;
  int_secret: string;
  email: string;
  referred_by?: string;

  sm_acc_count: number;
  sm_acc_limit_incr?: number;
  sm_acc_limit: number;

  notion_db_limit: number;
  notion_db_count: number;
  notion_db_limit_incr?: number;

  affiliate_partner?: string;
  customLimits?: boolean;
  billing: {
    plan_id: PRICING_PLAN_ID;
    trial_end: number;
    trial_start: number;
    trial_used: boolean;
    status: STRIPE_SUB_STATUS;
    sub_id: string;
    cust_id: string;
    invoice_url?: string;
    end_at: number;
    start_at: number;
  };
  // This is the common settings for all the databases
  ndb_settings?: {
    props: NotionDatabase["props"];
    post_metric_tracking: NotionDatabase["post_metric_tracking"];
    rules: NotionDatabase["rules"];
    ns_filter: NotionDatabase["ns_filter"];
    publish_changes: NotionDatabase["publish_changes"];
    formatting_options: NotionDatabase["formatting_options"];
    options: NotionDatabase["options"];
  };
}
export type AuthorUser = Partial<{
  uuid: string;
  email: string;
  plan: PricingPlan;
  hasActiveSubscription: boolean;
  hasPaidSubscription: boolean;
  monthPostCount: number;
  reachedFreePostsQuota: boolean;
}>;

export type NotionRuleCode = "in-reel>video" | "publish" | "link>text" | "video>images";
export type NotionRuleFilter = {
  [key in NotionRuleCode]: string;
};
export type ParsedNotionRules = Record<NotionRuleCode, boolean> | {[name: string]: boolean};
export const SupportedNotionRulePropTypes = [
  "select",
  "rich_text",
  "multi_select",
  "checkbox",
] as const;
export type NotionPropertyType = (typeof SupportedNotionRulePropTypes)[number];
export type NotionRule = {
  property?: string;
  type?: NotionPropertyType;
  rule?: "contains" | "equals";
  match?: string;
};

export type PinterestBoard = {
  id: string;
  name: string;
  privacy: "PUBLIC" | "PROTECTED" | "SECRET";
  sections?: {id: string; name: string}[];
};

export interface SocialAccountData {
  state: "active" | "expired";
  author_uid: string;
  platform_uid: string;
  platform: SocialPlatformTypes;
  tag?: string;
  name: string;
  username: string;
  dp: string;
  image: string;
  auth: {
    access_token: string;
    access_secret?: string;
    oauth_token?: string;
    oauth_token_secret?: string;
  };
  fb_auth?: {
    access_token: string;
    expires?: number;
  };
  uid: string;
  active?: boolean;
  acc_type?: "page" | "group";
  org_type?: string;
  role?: string;
  role_state?: string;
  li_user_id?: string;
  fb_user_id?: string;
  boards?: PinterestBoard[];
}

export type SocialPlatformTypes =
  | "twitter"
  | "facebook"
  | "linkedin"
  | "instagram"
  | "youtube"
  | "tiktok"
  | "pinterest"
  | "threads";
export interface NotionDatabaseClient {
  uid: NotionDatabase["uid"];
  link_id: NotionDatabase["link_id"];
  author_uid: NotionDatabase["author_uid"];
  locked?: boolean;
  ns_filter: NotionDatabase["ns_filter"];
  props: NotionDatabase["props"];
  stat_props?: NotionDatabase["stat_props"];
  post_metric_tracking?: NotionDatabase["post_metric_tracking"];
  sm_accs?: NotionDatabase["sm_accs"];
  sm_accs_arr: string[];
  rules?: NotionDatabase["rules"];
  url: NotionDatabase["url"];
  name: NotionDatabase["name"];
}

export interface ProcessedMediaRecord {
  ref_id: string;
  transformations: Array<MediaTransformation>;
}
export interface PostRecord {
  notion_page_id: string;
  notion_db_id: string;
  author_uid: string;
  cloudtask_name?: string;
  platforms?: {
    [platform_uid: string]: {
      error?: string;
      isTknError?: boolean;
      response?: any;
      completed?: boolean;
      isServerError?: boolean;
      postType?: PostType;
      first_comment: {
        error?: string;
        response?: any;
        completed_at?: boolean;
      };
    };
  };
  publish_at?: number;
  scheduled_at: number;
  completed: boolean;
  last_processed_at?: number;
  push_id?: string;
  processing?: boolean;
  success_platforms?: string[];
  status?: "success" | "error" | "partial_error";
  processed_media?: ProcessedMediaRecord[];
}

export type STRIPE_SUB_STATUS =
  | "active"
  | "unpaid"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "trialing";

export interface User {
  billing: UserData["billing"];
  avatar: string;
  sm_acc_count: number;
  sm_acc_limit_incr?: number;
  sm_acc_limit: number;
  post_limit: number;
  notion_db_limit: number;
  notion_db_count: number;
  notion_db_limit_incr?: number;
  affiliate_partner?: string;
  customLimits?: boolean;
  affiliate?: any;
  jwt: string;
  profile?: {
    url?: string;
    username: string;
    name: string;
    dp: string;
  };
  subActive: boolean;
  paidUser: boolean;
  readyToPost: boolean;
  trialDaysLeft: number;
  trialPeriodDays: number;
  plan?: PricingPlan;
  uid: String;
  uuid: String;
  email: String;
  emailVerified: boolean;
  isNewUser?: boolean;
  created_at?: number;
}

export interface PlatformPostPublishResult extends Partial<PlatformPublishResponse> {
  pid: string;
  tag: string;
  platform: string;
  username: string;
}

export interface Content {
  text: string;
  paragraphs: Thread[];
  title?: string;
  altText?: string;
  threads: Thread[];
  twitter: TwitterContent;
  media?: Array<MediaType>;
}

export interface PlatformError {
  code: number;
  error: string | any;
  isTknError: boolean;
  ignore?: boolean;
  isServerError: boolean;
}
export interface SocialMediaPostData {
  likes: number;
  comments: number;
  shares?: number;
  saves?: number;
  views?: number;
  reposts?: number;
  url?: string;
  quotes?: number;
  impressions?: number;
  profileVisits?: number;
  newFollowers?: number;
}

export interface NotionAuthData {
  bot_id: string;
  workspace_id: string;
  access_token: string;
  workspace_name: string;
  workspace_icon: string;
  duplicated_template_id: string;
  owner: {workspace: true} | {object: "user"};
}
export interface InstagramPostOptions {
  imageUserTags: string[];
  collaboratorTags: string[];
  locationTag: string;
}
export interface UpdateNdbPayload {
  props?: NotionDatabase["props"];
  ns_filter?: string;
  sm_accs?: NotionDatabase["sm_accs"];
  rules?: NotionDatabase["rules"];
  stat_props?: NotionDatabase["stat_props"];
  publish_changes?: NotionDatabase["publish_changes"];
  post_metric_tracking?: NotionDatabase["post_metric_tracking"];
  options?: NotionDatabase["options"];
}
export type NotionPage = GetPageResponse;
export type NotionProperties = Record<string, NotionProperty>;
export type NotionBlock = BlockObjectResponse;
export type NotionBlockType = BlockObjectResponse["type"];
export type NotionSelectProperty = Extract<NotionProperty, {type: "select"}>;
export type NotionTitleProperty = Extract<NotionProperty, {type: "title"}>;
export type NotionTextProperty = Extract<NotionProperty, {type: "rich_text"}>;
export type NotionFormulaProperty = Extract<NotionProperty, {type: "formula"}>;
export type NotionMultiSelectProperty = Extract<NotionProperty, {type: "multi_select"}>;
export type NotionDateProperty = Extract<NotionProperty, {type: "date"}>;
export type NotionFilesProperty = Extract<NotionProperty, {type: "files"}>;
export type NotionColor = TextRichTextItemResponse["annotations"]["color"];
export type NotionProperty =
  | NumberedListItemBlockObjectResponse
  | UrlPropertyItemObjectResponse
  | SelectPropertyItemObjectResponse
  | MultiSelectPropertyItemObjectResponse
  | StatusPropertyItemObjectResponse
  | DatePropertyItemObjectResponse
  | EmailPropertyItemObjectResponse
  | PhoneNumberPropertyItemObjectResponse
  | CheckboxPropertyItemObjectResponse
  | FilesPropertyItemObjectResponse
  | TitlePropertyItemObjectResponse
  | RichTextPropertyItemObjectResponse
  | TitlePropertyItemObjectResponse
  | FormulaPropertyItemObjectResponse;
export type NotionRichTextPayload = {
  text: {
    content: string;
    link?: {
      url: string;
    } | null;
  };
  type?: "text";
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: NotionColor;
  };
};
export type NotionFiles = NotionFilesProperty["files"];

export type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type Thread = {
  media: Array<ArrayElement<Content["media"]> & {id?: string}>;
  text: string;
};
export type BaseTwitterPost = {
  text: string;
  url?: string;
  replyToTweetId?: string;
  quoteTweetId?: string;
  retweetId?: string;
};
export type TwitterTweet = Array<
  BaseTwitterPost & {
    media: Content["media"];
  }
>;
export type TwitterContent = Array<
  BaseTwitterPost & {
    media: Array<ArrayElement<Content["media"]> & {id?: string}>;
  }
>;
export interface FormattingOptions {
  addLineBreakOnParagraphBlock?: boolean;
  disableTextFormatting?: boolean;
}
export interface NotionPagePropertiesForPost {
  nsProp: NotionTextProperty;
  titleProp: NotionTitleProperty;
  commentProp: NotionTextProperty | NotionFormulaProperty;
  captionProp: NotionTextProperty | NotionFormulaProperty;
  schTimeProp: NotionDateProperty;
  smAccsProp: NotionMultiSelectProperty;
  mediaProp: NotionFilesProperty;
  statusProp: NotionSelectProperty;
  pinterestBoardProp: NotionSelectProperty;
  altTextProp: NotionTextProperty;
  imageUserTagsProp: NotionMultiSelectProperty;
  collaboratorTagsProp: NotionMultiSelectProperty;
  locationTagsProp: NotionSelectProperty;
  youtubePrivacyStatusProp: NotionSelectProperty;
}
export interface NotionPagePostConfig {
  _pageId: string;
  _props: NotionPagePropertiesForPost;
  _properties: NotionProperties;
  _data: NotionDatabase;
  nsFilter: string;
  media: NotionFilesProperty["files"];
  titleText: string;
  captionText: string;
  commentText: string;
  schTime: number;
  status: string;
  pinterestBoardOption: NotionSelectProperty["select"];
  altText: string;
  imageUserTags: string[];
  collaboratorTags: string[];
  locationTag: string;
  youtubePrivacyStatus: "public" | "unlisted" | "private";
  smAccs: NotionDatabase["sm_accs"];
  filesToDownload: Array<"image" | "video" | "doc">;
  rules: {};
  isPostReadyToSchedule: boolean;
  formattingOptions: FormattingOptions;
}
export interface NotionCodedTextPayload {
  text: string;
  color?: NotionColor;
  br?: boolean;
  sp?: boolean;
  ul?: boolean;
}
export interface BaseLinkedInPost {
  text: string;
  quotePostId?: string | null;
  replyToPostId?: string | null;
  repostId?: string | null;
}
export type PostPublishStage = (typeof postPublishStages)[number];
export type FirstoreRef = firestore.DocumentReference<firestore.DocumentData>;
export interface FirestoreDoc<T = firestore.DocumentData> {
  id?: string;
  ref: firestore.DocumentReference<firestore.DocumentData>;
  data: T;
}
