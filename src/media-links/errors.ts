import {Data} from "effect";
import {explain} from "../platform-spec";
import type {LinkErrorCode} from "./schema";

// A media link that gives no file; message is the catalogue text the page shows (#51).
export class MediaLinkError extends Data.TaggedError("MediaLinkError")<{errorCode: LinkErrorCode; url: string; message: string}> {}

export const linkError = (errorCode: LinkErrorCode, url: string) => new MediaLinkError({errorCode, url, message: explain(errorCode).message});
