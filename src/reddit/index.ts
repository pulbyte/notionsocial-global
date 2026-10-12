import {Schema} from "effect";
import {explain} from "../platform-spec";
import {Flairs, MediaLease, RedditPage, PostRequirements, RedditMe, RedditToken, SocketMessage, SubmitAnswer, SubredditAbout, SubredditListing, type RedditFailure} from "./schema";

export {FLAIR_PROP, SUBREDDIT_PROP, redditPageFields, subredditName} from "./page";

export {isFailure, planRedditPost, type RedditPlan} from "./plan";

export {checkRules, matchFlair, submitFailure, type SubredditRules} from "./rules";

export type {Flair, RedditFailure} from "./schema";

// Decoders for each Reddit answer (#77); they throw on a shape the code does not expect.
export const decodeReddit = {
  page: Schema.decodeUnknownSync(RedditPage),
  token: Schema.decodeUnknownSync(RedditToken),
  me: Schema.decodeUnknownSync(RedditMe),
  subreddits: Schema.decodeUnknownSync(SubredditListing),
  requirements: Schema.decodeUnknownSync(PostRequirements),
  about: Schema.decodeUnknownSync(SubredditAbout),
  flairs: Schema.decodeUnknownSync(Flairs),
  submit: Schema.decodeUnknownSync(SubmitAnswer),
  lease: Schema.decodeUnknownSync(MediaLease),
  socket: Schema.decodeUnknownSync(SocketMessage),
};

// The text the page shows: the catalogue message, then Reddit's own words when it gave some.
export function redditErrorText(failure: RedditFailure): string {
  const message = explain(failure.code).message;

  return failure.detail ? `${message} (Reddit: ${failure.detail})` : message;
}
