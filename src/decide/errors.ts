import {Data} from "effect";

export class TypeSafeTimeout extends Data.TaggedError("TypeSafeTimeout")<{ms: number}> {}

export class TypeSafeHttpError extends Data.TaggedError("TypeSafeHttpError")<{status: number}> {}

export class TypeSafeBadAnswer extends Data.TaggedError("TypeSafeBadAnswer")<{issue: string}> {}

// The question would send a token or a page body; it is never sent.
export class UnsafePayload extends Data.TaggedError("UnsafePayload")<{field: string}> {}
