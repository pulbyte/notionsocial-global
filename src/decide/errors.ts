import {Data} from "effect";

export class ClefTimeout extends Data.TaggedError("ClefTimeout")<{ms: number}> {}

export class ClefHttpError extends Data.TaggedError("ClefHttpError")<{status: number}> {}

export class ClefBadAnswer extends Data.TaggedError("ClefBadAnswer")<{issue: string}> {}

// The question would send a token or a page body; it is never sent.
export class UnsafePayload extends Data.TaggedError("UnsafePayload")<{field: string}> {}
