import {spec} from "../platform-spec";
import type {RedditFailure} from "./schema";

// The fields of a media item the plan reads (global Media has them).
export type PlanMedia = {type: string; mimeType: string};

export type RedditPostInput<M extends PlanMedia> = {title: string; text: string; media: readonly M[]; poster?: M};

export type RedditPlan<M extends PlanMedia> =
  | {kind: "self"; title: string; text: string}
  | {kind: "link"; title: string; url: string}
  | {kind: "image"; title: string; image: M}
  | {kind: "gallery"; title: string; images: M[]}
  | {kind: "video"; title: string; video: M; poster: M};

const REDDIT = spec("reddit");

const ONLY_URL = /^https?:\/\/\S+$/i;

const isImage = (m: PlanMedia) => m.type === "image" && REDDIT.media.images.includes(m.mimeType);

const isVideo = (m: PlanMedia) => m.type === "video" && REDDIT.media.videos.includes(m.mimeType);

function mediaPlan<M extends PlanMedia>(title: string, media: readonly M[], poster?: M): RedditPlan<M> | RedditFailure {
  const images = media.filter(isImage);
  const video = media.find(isVideo);

  if (video) {
    const cover = poster ?? images[0];

    return cover ? {kind: "video", title, video, poster: cover} : {code: "reddit-video-cover"};
  }

  const [first] = images;

  if (!first) return {code: "media-type-unsupported"};

  return images.length > 1 ? {kind: "gallery", title, images: images.slice(0, REDDIT.media.max)} : {kind: "image", title, image: first};
}

// #77: the kind of post a Page makes. Media wins (video, else gallery, else one image); a body that
// is only a URL is a link post; anything else is a text post. Reddit media posts take no body.
export function planRedditPost<M extends PlanMedia>(input: RedditPostInput<M>): RedditPlan<M> | RedditFailure {
  const title = input.title.trim();
  const text = input.text.trim();

  if (!title) return {code: "reddit-no-title"};

  if (title.length > (REDDIT.title ?? 0)) return {code: "reddit-title-rules", detail: `${REDDIT.title} characters at most`};

  if (input.media.length) return mediaPlan(title, input.media, input.poster);

  if (ONLY_URL.test(text)) return {kind: "link", title, url: text};

  if (text.length > REDDIT.text.max) return {code: "reddit-body-rules", detail: `${REDDIT.text.max} characters at most`};

  return {kind: "self", title, text};
}

export const isFailure = <M extends PlanMedia>(p: RedditPlan<M> | RedditFailure): p is RedditFailure => "code" in p;
