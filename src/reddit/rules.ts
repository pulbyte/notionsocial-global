import type {PlanMedia, RedditPlan} from "./plan";
import type {Flair, PostRequirements, RedditErrorCode, RedditFailure, SubredditAbout} from "./schema";

// What the publisher read about the subreddit before submitting; a missing part is not checked.
export type SubredditRules = {requirements?: PostRequirements; about?: SubredditAbout["data"]; flairs?: readonly Flair[]};

type Plan = RedditPlan<PlanMedia>;

const ALLOWED: Record<Plan["kind"], keyof SubredditAbout["data"]> = {
  self: "submission_type",
  link: "submission_type",
  image: "allow_images",
  gallery: "allow_galleries",
  video: "allow_videos",
};

function postTypeFailure(plan: Plan, about: SubredditAbout["data"] | undefined): RedditFailure | undefined {
  const type = about?.submission_type;
  const textOnly = type === "self" && plan.kind !== "self";
  const noText = type === "link" && plan.kind === "self";
  const flag = ALLOWED[plan.kind];
  const mediaOff = flag !== "submission_type" && about?.[flag] === false;

  return textOnly || noText || mediaOff ? {code: "reddit-post-type", detail: `this subreddit takes ${type ?? "other"} posts`} : undefined;
}

const has = (text: string, words: readonly string[] | null | undefined) =>
  (words ?? []).filter((w) => text.toLowerCase().includes(w.toLowerCase()));

function titleLength(title: string, req: PostRequirements | undefined): RedditFailure | undefined {
  const min = req?.title_text_min_length ?? 0;
  const max = req?.title_text_max_length ?? Infinity;

  return title.length < min || title.length > max ? {code: "reddit-title-rules", detail: `${min}-${max} characters`} : undefined;
}

function titleWords(title: string, req: PostRequirements | undefined): RedditFailure | undefined {
  const required = req?.title_required_strings ?? [];
  const banned = has(title, req?.title_blacklisted_strings);

  if (required.length && !has(title, required).length) return {code: "reddit-title-rules", detail: `must include one of: ${required.join(", ")}`};

  return banned.length ? {code: "reddit-title-rules", detail: `not allowed: ${banned.join(", ")}`} : undefined;
}

function bodyPolicy(text: string, policy: string | null | undefined): RedditFailure | undefined {
  if (policy === "required" && !text) return {code: "reddit-body-rules", detail: "post text is required"};

  return policy === "notAllowed" && text ? {code: "reddit-body-rules", detail: "post text is not allowed"} : undefined;
}

function bodyFailure(plan: Plan, req: PostRequirements | undefined): RedditFailure | undefined {
  if (plan.kind !== "self") return undefined;

  const banned = has(plan.text, req?.body_blacklisted_strings);

  return bodyPolicy(plan.text, req?.body_restriction_policy) ?? (banned.length ? {code: "reddit-body-rules", detail: `not allowed: ${banned.join(", ")}`} : undefined);
}

const flairNames = (flairs: readonly Flair[] | undefined) => (flairs ?? []).map((f) => f.text ?? "").filter(Boolean).join(", ");

// A flair by its text (any case) or id.
export function matchFlair(flairs: readonly Flair[] | undefined, wanted: string): Flair | undefined {
  const w = wanted.trim().toLowerCase();

  return flairs?.find((f) => f.id === wanted.trim() || (f.text ?? "").trim().toLowerCase() === w);
}

function flairPick(rules: SubredditRules, wanted: string | undefined): {flair?: Flair} | RedditFailure {
  const detail = flairNames(rules.flairs) || undefined;

  if (!wanted) return rules.requirements?.is_flair_required ? {code: "reddit-flair-required", detail} : {};

  // A subreddit with flairs turned off answers no list; the flair is left out.
  if (!rules.flairs) return {};

  const flair = matchFlair(rules.flairs, wanted);

  return flair ? {flair} : {code: "reddit-flair-unknown", detail};
}

// #77: the subreddit rule the plan breaks, else the flair to send.
export function checkRules(plan: Plan, rules: SubredditRules, wanted?: string): {flair?: Flair} | RedditFailure {
  return (
    postTypeFailure(plan, rules.about) ??
    titleLength(plan.title, rules.requirements) ??
    titleWords(plan.title, rules.requirements) ??
    bodyFailure(plan, rules.requirements) ??
    flairPick(rules, wanted)
  );
}

// Reddit's submit error codes -> catalogue entries; field picks title or body for TOO_LONG.
const SUBMIT_CODES = new Map<string, RedditErrorCode>([
  ["SUBREDDIT_NOEXIST", "reddit-subreddit-missing"],
  ["SUBREDDIT_REQUIRED", "reddit-no-subreddit"],
  ["SUBREDDIT_NOTALLOWED", "reddit-not-allowed"],
  ["SUBREDDIT_NO_ACCESS", "reddit-not-allowed"],
  ["BANNED_FROM_SUBREDDIT", "reddit-not-allowed"],
  ["IN_TIMEOUT", "reddit-not-allowed"],
  ["SUBMIT_VALIDATION_FLAIR_REQUIRED", "reddit-flair-required"],
  ["NO_SELFS", "reddit-post-type"],
  ["NO_LINKS", "reddit-post-type"],
  ["NO_IMAGES", "reddit-post-type"],
  ["NO_VIDEOS", "reddit-post-type"],
  ["NO_GALLERIES", "reddit-post-type"],
  ["NO_TEXT", "reddit-no-title"],
  ["RATELIMIT", "reddit-rate-limit"],
  ["ALREADY_SUB", "reddit-duplicate-link"],
]);

function submitCode(code: string, field: string): RedditErrorCode | undefined {
  if (code === "TOO_LONG") return field === "title" ? "reddit-title-rules" : "reddit-body-rules";

  if (code.startsWith("SUBMIT_VALIDATION_TITLE")) return "reddit-title-rules";

  if (code.startsWith("SUBMIT_VALIDATION_BODY")) return "reddit-body-rules";

  return SUBMIT_CODES.get(code);
}

// The first error of a submit answer ([code, message, field]); code undefined = no catalogue entry.
export function submitFailure(errors: readonly (readonly unknown[])[] | null | undefined): {code?: RedditErrorCode; detail: string} | undefined {
  const [first] = errors ?? [];

  if (!first) return undefined;

  const [code, message, field] = first.map((v) => String(v ?? ""));

  return {code: submitCode(code ?? "", field ?? ""), detail: message || code || "submit failed"};
}
