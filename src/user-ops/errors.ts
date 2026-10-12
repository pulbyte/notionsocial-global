import {Data} from "effect";

export class UserNotFound extends Data.TaggedError("UserNotFound")<{email: string}> {}

// The new email already belongs to another login.
export class EmailTaken extends Data.TaggedError("EmailTaken")<{email: string}> {}

export class AuthUpdateFailed extends Data.TaggedError("AuthUpdateFailed")<{message: string}> {}

export class NoSubscription extends Data.TaggedError("NoSubscription")<{uid: string}> {}

export class SubscriptionCanceled extends Data.TaggedError("SubscriptionCanceled")<{subId: string}> {}

// Self-serve extensions are for trials only; a paid subscription is never extended.
export class NotInTrial extends Data.TaggedError("NotInTrial")<{status: string}> {}

export class TrialAlreadyExtended extends Data.TaggedError("TrialAlreadyExtended")<{at: number}> {}

export class AffiliateExists extends Data.TaggedError("AffiliateExists")<{linkName: string}> {}

export class AffiliateNotFound extends Data.TaggedError("AffiliateNotFound")<{uid: string}> {}

// A Stripe write that must succeed (delete stops here so billing never outlives the account).
export class StripeFailed extends Data.TaggedError("StripeFailed")<{step: string; message: string}> {}

// Any other failed call; port names the call (e.g. "store.getUser").
export class PortFailed extends Data.TaggedError("PortFailed")<{port: string; message: string}> {}

export type UserOpsError =
  | UserNotFound
  | EmailTaken
  | AuthUpdateFailed
  | NoSubscription
  | SubscriptionCanceled
  | NotInTrial
  | TrialAlreadyExtended
  | AffiliateExists
  | AffiliateNotFound
  | StripeFailed
  | PortFailed;

// Plain failure for Promise callers (functions, admin) that do not load effect's types.
export const USER_OPS_ERROR_CODES = [
  "UserNotFound",
  "EmailTaken",
  "AuthUpdateFailed",
  "NoSubscription",
  "SubscriptionCanceled",
  "NotInTrial",
  "TrialAlreadyExtended",
  "AffiliateExists",
  "AffiliateNotFound",
  "StripeFailed",
  "PortFailed",
] as const satisfies readonly UserOpsError["_tag"][];

// The tag as code, plus that error's own fields.
export type UserOpsFailure = {
  code: (typeof USER_OPS_ERROR_CODES)[number];
  email?: string;
  uid?: string;
  subId?: string;
  status?: string;
  at?: number;
  linkName?: string;
  step?: string;
  port?: string;
  message?: string;
};

export const toFailure = (e: UserOpsError): UserOpsFailure => {
  const {_tag, ...fields} = {...e};

  // Error keeps message off the own enumerable fields, so it is copied by name.
  return {code: _tag, ...fields, ...(e.message && {message: e.message})};
};
