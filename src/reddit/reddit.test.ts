import fc from "fast-check";
import {describe, expect, it} from "vitest";
import {codeForMessage} from "../platform-spec";
import {checkRules, decodeReddit, planRedditPost, redditErrorText, redditPageFields, submitFailure, subredditName, type RedditPlan} from "./index";

type M = {type: string; mimeType: string; name: string};

const img = (name: string, mimeType = "jpg"): M => ({type: "image", mimeType, name});

const vid = (name: string): M => ({type: "video", mimeType: "mp4", name});

const kindOf = (p: RedditPlan<M> | {code: string}) => ("code" in p ? p.code : p.kind);

describe("subredditName", () => {
  it.each([
    ["r/NotionSocial", "NotionSocial"],
    ["/r/notion/", "notion"],
    ["https://www.reddit.com/r/notion/new", "notion"],
    ["notion", "notion"],
    ["u/pulkit", "u_pulkit"],
    ["", undefined],
    ["r/", undefined],
    ["has space", undefined],
    ["a", undefined],
  ])("%s -> %s", (value, name) => expect(subredditName(value)).toBe(name));

  it("any valid name round-trips through every written form", () => {
    const name = fc.stringMatching(/^[A-Za-z0-9_]{2,21}$/);

    fc.assert(
      fc.property(name, (n) => {
        for (const v of [n, `r/${n}`, `/r/${n}/`, `https://reddit.com/r/${n}`, ` ${n} `]) expect(subredditName(v)).toBe(n);
      }),
    );
  });

  it("never returns a name with a slash or space", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(subredditName(s) ?? "ok").not.toMatch(/[\s/]/);
      }),
    );
  });
});

describe("redditPageFields", () => {
  it("reads a select subreddit and a text flair", () => {
    const fields = redditPageFields(
      decodeReddit.page({
        Name: {type: "title", title: [{plain_text: "Weekly update"}]},
        "Reddit - Subreddit": {type: "select", select: {name: "r/notion"}},
        "Reddit - Flair": {type: "rich_text", rich_text: [{plain_text: "Showcase "}]},
      }),
    );

    expect(fields).toEqual({subreddit: "notion", rawSubreddit: "r/notion", flair: "Showcase"});
  });

  it("an empty page names nothing", () => expect(redditPageFields(decodeReddit.page({}))).toEqual({subreddit: undefined, rawSubreddit: ""}));

  it("an empty select reads as no subreddit", () =>
    expect(redditPageFields(decodeReddit.page({"Reddit - Subreddit": {type: "select", select: null}})).subreddit).toBeUndefined());
});

describe("planRedditPost", () => {
  it.each([
    ["text", {title: "T", text: "hello", media: []}, "self"],
    ["title only", {title: "T", text: "", media: []}, "self"],
    ["only a URL", {title: "T", text: " https://notionsocial.app ", media: []}, "link"],
    ["URL inside text", {title: "T", text: "see https://notionsocial.app", media: []}, "self"],
    ["one image", {title: "T", text: "x", media: [img("a")]}, "image"],
    ["two images", {title: "T", text: "", media: [img("a"), img("b", "png")]}, "gallery"],
    ["video + image poster", {title: "T", text: "", media: [vid("v"), img("p")]}, "video"],
    ["video without poster", {title: "T", text: "", media: [vid("v")]}, "reddit-video-cover"],
    ["pdf only", {title: "T", text: "", media: [{type: "doc", mimeType: "pdf", name: "d"}]}, "media-type-unsupported"],
    ["webp image", {title: "T", text: "", media: [img("a", "webp")]}, "media-type-unsupported"],
    ["no title", {title: "  ", text: "x", media: []}, "reddit-no-title"],
    ["title over 300", {title: "x".repeat(301), text: "", media: []}, "reddit-title-rules"],
    ["body over 40,000", {title: "T", text: "x".repeat(40001), media: []}, "reddit-body-rules"],
  ])("%s", (_, input, kind) => expect(kindOf(planRedditPost<M>(input))).toBe(kind));

  it("a gallery keeps at most spec media.max images", () => {
    const plan = planRedditPost<M>({title: "T", text: "", media: Array.from({length: 25}, (_, i) => img(`i${i}`))});

    expect("kind" in plan && plan.kind === "gallery" && plan.images.length).toBe(20);
  });

  it("the thumbnail property wins as the video poster", () => {
    const plan = planRedditPost<M>({title: "T", text: "", media: [vid("v"), img("first")], poster: img("cover")});

    expect("kind" in plan && plan.kind === "video" && plan.poster.name).toBe("cover");
  });
});

describe("checkRules", () => {
  const self = {kind: "self", title: "Weekly update", text: "body"} as const;
  const image = {kind: "image", title: "Weekly update", image: img("a")} as const;
  const flairs = [{id: "f1", text: "Showcase"}, {id: "f2", text: "Question"}];

  it.each([
    ["text post in a link-only subreddit", self, {about: {submission_type: "link"}}, undefined, "reddit-post-type"],
    ["image in a text-only subreddit", image, {about: {submission_type: "self"}}, undefined, "reddit-post-type"],
    ["image where images are off", image, {about: {allow_images: false}}, undefined, "reddit-post-type"],
    ["title too short", self, {requirements: {title_text_min_length: 20}}, undefined, "reddit-title-rules"],
    ["title misses a required word", self, {requirements: {title_required_strings: ["[OC]"]}}, undefined, "reddit-title-rules"],
    ["banned word in the body", self, {requirements: {body_blacklisted_strings: ["BODY"]}}, undefined, "reddit-body-rules"],
    ["body required", {...self, text: ""}, {requirements: {body_restriction_policy: "required"}}, undefined, "reddit-body-rules"],
    ["flair required, none given", self, {requirements: {is_flair_required: true}, flairs}, undefined, "reddit-flair-required"],
    ["flair not in the list", self, {flairs}, "Meme", "reddit-flair-unknown"],
  ])("%s", (_, plan, rules, flair, code) => expect(checkRules(plan, rules, flair)).toMatchObject({code}));

  it("a matching flair (any case) is sent", () => expect(checkRules(self, {flairs}, "showcase")).toEqual({flair: flairs[0]}));

  it("no rules, no flair: nothing to check", () => expect(checkRules(self, {})).toEqual({}));

  it("the failure lists the subreddit's flairs", () =>
    expect(checkRules(self, {requirements: {is_flair_required: true}, flairs})).toEqual({code: "reddit-flair-required", detail: "Showcase, Question"}));
});

describe("submitFailure", () => {
  it.each([
    [[["SUBREDDIT_NOEXIST", "that subreddit doesn't exist", "sr"]], "reddit-subreddit-missing"],
    [[["SUBMIT_VALIDATION_FLAIR_REQUIRED", "Your post must contain post flair.", "flair"]], "reddit-flair-required"],
    [[["NO_SELFS", "This community doesn't allow text posts.", "sr"]], "reddit-post-type"],
    [[["RATELIMIT", "Looks like you've been doing that a lot. Take a break for 9 minutes.", "ratelimit"]], "reddit-rate-limit"],
    [[["TOO_LONG", "this is too long (max: 300)", "title"]], "reddit-title-rules"],
    [[["ALREADY_SUB", "that link has already been submitted", "url"]], "reddit-duplicate-link"],
    [[["SOMETHING_NEW", "new rule", "x"]], undefined],
  ])("%j -> %s", (errors, code) => expect(submitFailure(errors)?.code).toBe(code));

  it("no errors, no failure", () => expect(submitFailure([])).toBeUndefined());
});

describe("redditErrorText", () => {
  it("maps back to its catalogue code with Reddit's words after it", () => {
    const text = redditErrorText({code: "reddit-flair-required", detail: "Showcase, Question"});

    expect(text).toMatch(/\(Reddit: Showcase, Question\)$/);
    expect(codeForMessage(text)).toBe("reddit-flair-required");
  });
});

describe("decodeReddit", () => {
  it("decodes a submit answer with errors and a media answer with a socket", () => {
    expect(decodeReddit.submit({json: {errors: [["RATELIMIT", "slow down", "ratelimit"]]}}).json.errors).toHaveLength(1);
    expect(decodeReddit.submit({json: {errors: [], data: {websocket_url: "wss://x", user_submitted_page: "u"}}}).json.data?.websocket_url).toBe("wss://x");
  });

  it("decodes post requirements with nulls", () =>
    expect(decodeReddit.requirements({is_flair_required: true, title_text_min_length: null, guidelines_text: null}).is_flair_required).toBe(true));

  it("throws on a token answer without a token", () => expect(() => decodeReddit.token({error: "invalid_grant"})).toThrow());
});
