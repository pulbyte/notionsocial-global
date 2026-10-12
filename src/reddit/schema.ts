import {Schema} from "effect";
import {postOption} from "../platform-spec";

// Reddit API answers (#77), the fields the publisher and connect flow read.
const optional = <S extends Schema.Top>(s: S) => Schema.optionalKey(Schema.NullOr(s));

// A Page property the subreddit or flair can be written in (select, text, title, formula, URL).
const NotionText = Schema.Array(Schema.Struct({plain_text: Schema.optionalKey(Schema.String)}));

export const NotionValue = Schema.Struct({
  select: optional(Schema.Struct({name: Schema.optionalKey(Schema.String)})),
  multi_select: optional(Schema.Array(Schema.Struct({name: Schema.optionalKey(Schema.String)}))),
  rich_text: optional(NotionText),
  title: optional(NotionText),
  formula: optional(Schema.Struct({string: optional(Schema.String)})),
  url: optional(Schema.String),
});

export type NotionValue = typeof NotionValue.Type;

// Property names the page uses (#77); the spec's post options name them for the capability page.
export const SUBREDDIT_PROP = postOption("reddit", "subreddit")?.property ?? "Reddit - Subreddit";

export const FLAIR_PROP = postOption("reddit", "flair")?.property ?? "Reddit - Flair";

// The two Page properties Reddit reads, from a Notion page's properties.
export const RedditPage = Schema.Struct({[SUBREDDIT_PROP]: optional(NotionValue), [FLAIR_PROP]: optional(NotionValue)});

export type RedditPage = typeof RedditPage.Type;

// POST /api/v1/access_token (authorization_code or refresh_token grant).
export const RedditToken = Schema.Struct({
  access_token: Schema.String,
  expires_in: Schema.Number,
  scope: Schema.String,
  refresh_token: Schema.optionalKey(Schema.String),
});

// GET /api/v1/me
export const RedditMe = Schema.Struct({id: Schema.String, name: Schema.String, icon_img: optional(Schema.String)});

// GET /subreddits/mine/subscriber
export const SubredditListing = Schema.Struct({
  data: Schema.Struct({
    after: optional(Schema.String),
    children: Schema.Array(Schema.Struct({data: Schema.Struct({display_name: Schema.String})})),
  }),
});

// GET /api/v1/{subreddit}/post_requirements
export const PostRequirements = Schema.Struct({
  is_flair_required: optional(Schema.Boolean),
  body_restriction_policy: optional(Schema.String), // required | notAllowed | none
  title_text_min_length: optional(Schema.Number),
  title_text_max_length: optional(Schema.Number),
  title_required_strings: optional(Schema.Array(Schema.String)),
  title_blacklisted_strings: optional(Schema.Array(Schema.String)),
  body_blacklisted_strings: optional(Schema.Array(Schema.String)),
});

export type PostRequirements = typeof PostRequirements.Type;

// GET /r/{subreddit}/about
export const SubredditAbout = Schema.Struct({
  data: Schema.Struct({
    submission_type: optional(Schema.String), // any | link | self
    allow_images: optional(Schema.Boolean),
    allow_videos: optional(Schema.Boolean),
    allow_galleries: optional(Schema.Boolean),
  }),
});

export type SubredditAbout = typeof SubredditAbout.Type;

// GET /r/{subreddit}/api/link_flair_v2
export const Flair = Schema.Struct({id: Schema.String, text: optional(Schema.String)});

export type Flair = typeof Flair.Type;

export const Flairs = Schema.Array(Flair);

// POST /api/submit and /api/submit_gallery_post.json with api_type=json. Image and video posts
// answer with websocket_url; the post id arrives on that socket.
export const SubmitAnswer = Schema.Struct({
  json: Schema.Struct({
    errors: optional(Schema.Array(Schema.Array(Schema.Unknown))),
    data: optional(
      Schema.Struct({
        id: optional(Schema.String),
        name: optional(Schema.String),
        url: optional(Schema.String),
        websocket_url: optional(Schema.String),
      }),
    ),
  }),
});

export type SubmitAnswer = typeof SubmitAnswer.Type;

// POST /api/media/asset.json: an S3 upload lease for one file.
export const MediaLease = Schema.Struct({
  args: Schema.Struct({action: Schema.String, fields: Schema.Array(Schema.Struct({name: Schema.String, value: Schema.String}))}),
  asset: Schema.Struct({asset_id: Schema.String, websocket_url: optional(Schema.String)}),
});

// A message on a media post's websocket: success carries the post URL in payload.redirect.
export const SocketMessage = Schema.Struct({
  type: Schema.String,
  payload: optional(Schema.Struct({redirect: optional(Schema.String), message: optional(Schema.String)})),
});

// Errors a submit can fail with that map to a catalogue entry.
export type RedditErrorCode =
  | "reddit-no-subreddit"
  | "reddit-no-title"
  | "reddit-subreddit-missing"
  | "reddit-not-allowed"
  | "reddit-flair-required"
  | "reddit-flair-unknown"
  | "reddit-post-type"
  | "reddit-title-rules"
  | "reddit-body-rules"
  | "reddit-rate-limit"
  | "reddit-duplicate-link"
  | "reddit-video-cover"
  | "media-type-unsupported";

// What a check returns when the post cannot go: the catalogue code and Reddit's own words.
export type RedditFailure = {code: RedditErrorCode; detail?: string};
