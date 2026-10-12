import {Schema} from "effect";
import {linkError} from "./errors";
import {canvaViewUrl, hostOf} from "./links";
import {CanvaEmbed, type HttpGet} from "./schema";

const decodeEmbed = Schema.decodeUnknownOption(Schema.fromJsonString(CanvaEmbed));

// canva.link/<code> redirects to the design; a design link is used as it is.
async function designUrl(url: string, get: HttpGet): Promise<string | undefined> {
  if (hostOf(url) !== "canva.link") return canvaViewUrl(url);

  return canvaViewUrl((await get(url)).url);
}

// The image of a public Canva design (its preview, as Canva's oEmbed gives it). A design that is
// not shared publicly, or a link that is not a design, fails with the canva-link entry (#51).
export async function canvaImageUrl(url: string, get: HttpGet): Promise<string> {
  const view = await designUrl(url, get);

  if (!view) throw linkError("canva-link", url);

  const res = await get(`https://www.canva.com/_oembed?url=${encodeURIComponent(view)}`);
  const embed = res.status === 200 ? decodeEmbed(res.body) : undefined;

  if (embed?._tag !== "Some") throw linkError("canva-link", url);

  // "?type=thumbnail" is a 600 px preview; without it Canva serves the 1024 px one.
  return embed.value.thumbnail_url.replace(/\?type=thumbnail$/, "");
}
