import {Schema} from "effect";

// A connected social account as the resolver sees it: the fields of sm_accs/{platform_uid}
// that identify it. Decoded from Firestore at the caller's boundary.
export const Account = Schema.Struct({
  platform_uid: Schema.String,
  platform: Schema.String,
  username: Schema.String,
  tag: Schema.optionalKey(Schema.String),
  handle: Schema.optionalKey(Schema.String),
  acc_type: Schema.optionalKey(Schema.String),
  last_updated_at: Schema.optionalKey(Schema.Finite),
});

export type Account = typeof Account.Type;

export const decodeAccounts = Schema.decodeUnknownSync(Schema.Array(Account));

// A named set of accounts (#69), account_groups/{id}: one Platforms option posts to each member.
export const AccountGroup = Schema.Struct({
  name: Schema.String,
  platform_uids: Schema.Array(Schema.String),
});

export type AccountGroup = typeof AccountGroup.Type;

export const decodeAccountGroups = Schema.decodeUnknownSync(Schema.Array(AccountGroup));

// How a Platforms value found its account (CONTEXT.md: Resolution).
type MatchRule = "platform_uid" | "group" | "written_tag" | "tag" | "alias" | "handle";

// Option names NotionSocial wrote into the database, with the account each was written for
// (notion_dbs/{id}.sm_accs). They still find the account after it is renamed.
export type WrittenTag = {tag: string; platform_uid: string};

export type Resolved = {value: string; account: Account; rule: MatchRule};

type UnmatchedReason = "no-account" | "ambiguous" | "unknown-platform" | "empty-group";

export type Unmatched = {value: string; reason: UnmatchedReason; candidates: string[]};

export type Resolution = {resolved: Resolved[]; unmatched: Unmatched[]};
