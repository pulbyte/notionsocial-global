import {FLAIR_PROP, SUBREDDIT_PROP} from "./schema";
import type {NotionValue, RedditPage} from "./schema";

export {FLAIR_PROP, SUBREDDIT_PROP} from "./schema";

const SUBREDDIT = /^[A-Za-z0-9_]{2,21}$/;

const PROFILE = /^[A-Za-z0-9_-]{3,20}$/;

// "r/Foo", "/r/foo/", "https://www.reddit.com/r/foo/new" -> "foo"; "u/me" -> "u_me" (the
// account's profile). undefined when the value is not a subreddit name.
export function subredditName(value: string | undefined): string | undefined {
  const raw = (value ?? "").trim().replace(/^https?:\/\/([a-z]+\.)?reddit\.com/i, "");
  const [first = "", second = ""] = raw.split("/").filter(Boolean);
  const scoped = /^[ru]$/i.test(first);
  const name = scoped ? second : first;

  if (scoped && first.toLowerCase() === "u") return PROFILE.test(name) ? `u_${name}` : undefined;

  return SUBREDDIT.test(name) ? name : undefined;
}

export type RedditPageFields = {subreddit?: string; flair?: string; rawSubreddit: string};

const plain = (parts: NotionValue["rich_text"]) => parts?.map((p) => p.plain_text ?? "").join("");

// One reader per property type: select, multi-select (first value), text, title, formula, URL.
const READERS: ((p: NotionValue) => string | null | undefined)[] = [
  (p) => p.select?.name,
  (p) => p.multi_select?.[0]?.name,
  (p) => plain(p.rich_text),
  (p) => plain(p.title),
  (p) => p.formula?.string,
  (p) => p.url,
];

function propText(prop: NotionValue | null | undefined): string {
  if (!prop) return "";

  for (const read of READERS) {
    const value = read(prop);

    if (value != null) return value.trim();
  }

  return "";
}

// The subreddit and flair a Page names (decodeReddit.page first). subreddit is undefined when the
// value is empty or not a subreddit name.
export function redditPageFields(page: RedditPage): RedditPageFields {
  const rawSubreddit = propText(page[SUBREDDIT_PROP]);
  const flair = propText(page[FLAIR_PROP]);

  return {subreddit: subredditName(rawSubreddit), rawSubreddit, ...(flair && {flair})};
}
