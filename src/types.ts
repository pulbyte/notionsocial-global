import {PricePlanLabel, PRICING_PLAN_ID, PricingPlan} from "./pricing";
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
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {firestore} from "firebase-admin";
import {postPublishStages} from "./publish";
import {SmAccTagFormats} from "env";
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

export type TransformedMedia = Media & {
  transformations: Array<
    Omit<MediaTransformation, "src"> & {
      buffer?: Buffer;
      url: string;
    }
  >;
};

// Media, Which is transformed.
export interface TMedia extends Media {
  transformation: Omit<MediaTransformation, "src"> | null;
}

// MediaFile, Which is downloaded.
export interface TMediaFile extends MediaFile {
  transformation: Omit<MediaTransformation, "src"> | null;
}

export type MediaType = Media | MediaFile | TransformedMedia;
export type MediaMetadata = {
  size: number;
  height: number;
  width: number;
  videoBitrate?: number;
  audioBitrate?: number;
  duration?: number;
  contentType?: string;
};
export type MediaCompression = "lossy" | "lossless";
export type MediaTransformationMethod =
  | "gcp-transcoder"
  | "ffmpeg"
  | "shortpixel.com"
  | "media.io"
  | "sharp"
  | "mux.com";

export interface MediaTransformation {
  metadata: MediaMetadata;
  method: MediaTransformationMethod;
  compression: MediaCompression;
  src: MediaSrc;
  platforms: SocialPlatformTypes[];
}

export interface BufferSrc {
  type: "buffer";
  buffer: Buffer;
}
export interface UrlSrc {
  type: "url";
  url: string;
}
export interface MuxSrc {
  type: "mux";
  asset_id: string;
  playback_id: string;
}
export interface BucketSrc {
  type: "bucket";
  path: string;
  uri?: string;
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
export interface NotionPropertyMetadata {
  name: string;
  id?: string;
  type?: NotionPropertyType;
}
export interface NotionDatabase {
  link_id: string;
  workspace_id: string;
  bot_id: string;
  author_uid: string;
  locked?: boolean;
  ns_filter: string;
  created_at: number;
  last_scanned_at?: number;
  image: string;
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
    likes?: MetricPropertyConfig | string;
    comments?: MetricPropertyConfig | string;
    shares?: MetricPropertyConfig | string;
    views?: MetricPropertyConfig | string;
    retweets?: MetricPropertyConfig | string;
    reposts?: MetricPropertyConfig | string;
    profile_visits?: MetricPropertyConfig | string;
    new_followers?: MetricPropertyConfig | string;
    saves?: MetricPropertyConfig | string;
  };
  stat_props?: {
    likes?: string;
    comments?: string;
    shares?: string;
    views?: string;
    retweets?: string;
    reposts?: string;
  };
  rules?: NotionRules<string>;
  access_token: string;
  sm_accs: {
    platform_uid: string;
    tag: string;
    username: string;
    platform: SocialPlatformTypes;
  }[];
  url: string;
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
  template_page_id?: string;
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
  pinterest_board_prop?: string;
  video_thumbnail_image_prop?: string;
  video_thumbnail_offset_prop?: string;
  cta_button_prop?: string;
  cta_link_prop?: string;
}
export interface PublicApiRecord {
  created_at: number;
  status: "active" | "revoked";
  hashed_api_key: string;
  user_id: string;
}
export interface UserData {
  uid: string;
  uuid: string;
  referred_by?: string;
  created_at: number;
  sm_acc_count: number;
  sm_acc_limit_incr?: number;
  sm_acc_limit: number;

  notion_db_limit: number;
  notion_db_count: number;
  notion_db_limit_incr?: number;

  on_connection?: {
    sm_acc?: {
      to_link_to_ndbs?: "all" | "ask" | "none";
    };
    ndb?: {
      ask_to_choose_props?: boolean;
      ask_to_add_more_ndbs?: boolean;
      to_link_sm_accs?: "all" | "ask" | "none";
    };
  };

  affiliate_partner?: boolean;
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
    cancel_at_period_end?: boolean;
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
  client_manager: {
    clients_limit: number;
    clients_count: number;
    name: string;
    username: string;
    contact_email: string;
    registered_at: number;
  };
}

export type SmAccTagFormat = (typeof SmAccTagFormats)[number];

// Define the tag format options
export type AuthorUser = Partial<{
  uuid: string;
  email: string;
  plan: PricingPlan;
  hasActiveSubscription: boolean;
  hasPaidSubscription: boolean;
  monthPostCount: number;
  reachedFreePostsQuota: boolean;
}>;

export type NotionRuleCode =
  | "in-reel>video"
  | "in-story>feed"
  | "fb-reel>video"
  | "fb-story>feed"
  | "reel>video"
  | "story>feed"
  | "short>video";

export type NotionRules<T = boolean> = Partial<Record<NotionRuleCode, T>>;

export const SupportedNotionRulePropTypes = [
  "select",
  "rich_text",
  "multi_select",
  "checkbox",
] as const;
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
  ig_auth_type?: "ig_oauth" | "fb_sdk";
  ig_user_id?: string;
  author_uid: string;
  platform_uid: string;
  platform: SocialPlatformTypes;
  created_at?: number;
  tag?: string;
  locked?: boolean;
  name: string;
  username: string;
  dp: string;
  last_updated_at?: number;
  auth?: {
    access_token?: string;
    access_secret?: string;
    refresh_token?: string;
    oauth_token?: string;
    oauth_token_secret?: string;
    last_updated_at?: number;
    expires?: number;
  };
  secure_auth_token?: SecureAuthToken;
  fb_auth?: {
    access_token: string;
    expires?: number;
  };
  handle?: string;
  urn?: string;
  active?: boolean;
  acc_type?: "page" | "group";
  org_type?: string;
  role?: string;
  role_state?: string;
  li_user_id?: string;
  fb_user_id?: string;
  boards?: PinterestBoard[];
  privacy_options?: string;
  video_duration_limit?: number;
  comment_disabled?: boolean;
}

export type SocialPlatformTypes =
  | "twitter"
  | "facebook"
  | "linkedin"
  | "instagram"
  | "youtube"
  | "tiktok"
  | "pinterest"
  | "threads"
  | "x"
  | "bluesky"
  | "gmb";
export interface NotionDatabaseClient {
  uid: NotionDatabase["link_id"];
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
  notion_page_title?: string;
  caption_spoiler?: string;
  publish_at?: number;
  scheduled_at: number;
  completed: boolean;
  last_processed_at?: number;
  push_id?: string;
  // Publish Task, processing, Not post_process processing
  processing?: boolean;
  success_platforms?: string[];
  status?: "success" | "error" | "partial_error" | "publishing" | "processing" | "processed";
  processed_media?: ProcessedMediaRecord[];
}

export type STRIPE_SUB_STATUS =
  | "active"
  | "unpaid"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "paused";

export interface AffiliatePayment {
  amount: number;
  date: number;
  note: string;
}

export interface AffiliateReferral {
  free_count: number;
  paid_count: number;
  total_count: number;
  total_value: number;
}

export interface Affiliate {
  author_uid: string;
  commission_rate: number;
  id: string;
  link: string;
  payments?: AffiliatePayment[];
  referral: AffiliateReferral;
  total_payout: number;
  paypal?: string;
  trial_days?: number;
  trial_plan?: Exclude<PricePlanLabel, "free">;
}

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
  affiliate_partner?: boolean;
  customLimits?: boolean;
  affiliate?: Affiliate;
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
  trialDaysLeft?: number;
  trialPeriodDays?: number;
  plan?: PricingPlan;
  uid: string;
  uuid: string;
  email: string;
  emailVerified: boolean;
  isNewUser?: boolean;
  created_at?: number;
  client_manager?: UserData["client_manager"];
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
  bluesky: Thread[];
  twitter: TwitterContent;
  media?: Array<MediaType>;
  videoThumbnail?: Media;
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

export interface NotionAuthResponse {
  bot_id: string;
  workspace_id: string;
  access_token: string;
  workspace_name?: string;
  workspace_icon?: string;
  duplicated_template_id?: string | null;
  owner?: {workspace: true} | {object: "user"};
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
export type NotionBlock = BlockObjectResponse & {children?: NotionBlock[]};
export type ParsedNotionBlock =
  | {type: "divider"}
  | {type: "text"; content: string}
  | {type: "media"; media: Media}
  | {type: "nil"; content: null};

export type NotionBlockType = BlockObjectResponse["type"];
export type NotionSelectProperty = Extract<NotionProperty, {type: "select"}>;
export type NotionTitleProperty = Extract<
  PageObjectResponse["properties"][keyof PageObjectResponse["properties"]],
  {type: "title"}
>;
export type NotionTextProperty = Extract<
  PageObjectResponse["properties"][keyof PageObjectResponse["properties"]],
  {type: "rich_text"}
>;
export type NotionFormulaProperty = Extract<
  PageObjectResponse["properties"][keyof PageObjectResponse["properties"]],
  {type: "formula"}
>;
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
  videoThumbnailProp?: NotionFilesProperty;
  ctaButtonProp?: NotionTextProperty | NotionSelectProperty;
  ctaLinkProp?: UrlPropertyItemObjectResponse;
}
export interface NotionPagePostConfig {
  _pageId: string;
  _props: NotionPagePropertiesForPost;
  _properties: NotionProperties;
  _data: NotionDatabase;
  nsFilter: string;
  archived: boolean;
  videoThumbnail: NotionFilesProperty["files"];
  media: NotionFilesProperty["files"];
  titleText: string;
  captionText: string;
  commentText: string;
  schTime: {
    rawStr: string;
    fmtTz: string;
    epochMs: number;
    date: Date;
  };
  status: string;
  pinterestBoardOption: NotionSelectProperty["select"];
  altText: string;
  altTextArr: string[];
  imageUserTags: string[];
  collaboratorTags: string[];
  locationTag: string;
  youtubePrivacyStatus: "public" | "unlisted" | "private";
  ctaButton: string;
  ctaLink: string;
  smAccs: NotionDatabase["sm_accs"];
  smAccsPlatforms: SocialPlatformTypes[];
  filesToDownload: Array<"image" | "video" | "doc">;
  rules: NotionRules;
  isPostReadyToSchedule: boolean;
  formattingOptions: FormattingOptions;
}
export interface NotionCodedTextPayload {
  text: string;
  color?: NotionColor;
  br?: boolean;
  sp?: boolean;
  ul?: boolean;
  code?: boolean;
  bold?: boolean;
}
export interface BaseLinkedInPost {
  text: string;
  quotePostId?: string | null;
  replyToPostId?: string | null;
  repostId?: string | null;
}
export type PostPublishStage = (typeof postPublishStages)[number];
export type FirestoreRef<T = firestore.DocumentData> = firestore.DocumentReference<T>;
export interface FirestoreDoc<T = firestore.DocumentData> {
  id?: string;
  ref: firestore.DocumentReference<firestore.DocumentData>;
  data: T;
}
export type StorageBucketName = "raw-post-media" | "optimized-post-media";
export type RequiredPick<T> = {[K in keyof T]-?: {} extends Pick<T, K> ? never : K}[keyof T];
export type OptionalPick<T> = {[K in keyof T]-?: {} extends Pick<T, K> ? K : never}[keyof T];
export interface SecureAuthToken {
  token: string; // The main token
  secret?: string; // Optional secret (used with some API tokens)
  refresh?: {
    token: string;
    expires_at?: number;
    refreshed_at?: number;
  };
  type: "oauth2" | "key" | "jwt" | "password";
  scopes?: string[]; // Permissions granted
  expires_at?: number; // Unix timestamp for expiration
  issued_at?: number; // When the token was created
  encryption?: {
    // For encrypted tokens
    algorithm?: "aes-256-cbc";
    iv: string; // Initialization vector
    key_version: string; // For key rotation
  };
}
export type QueueName =
  | "post-schedule-queue"
  | "bg-job-queue"
  | "crawl-queue"
  | "dev-post-queue"
  | "first-comment-queue";

export type CloudRunFunction =
  | "schedule"
  | "postcrawl"
  | "publish"
  | "first_comment"
  | "smaccaudit"
  | "api"
  | "crawl";
export type CloudRunService = "post_process";
export type NotionPropertyType =
  PageObjectResponse["properties"][keyof PageObjectResponse["properties"]]["type"];
