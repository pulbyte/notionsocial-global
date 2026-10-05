// What happened to a user's post, account or database (#34). Controllers emit these;
// the router decides who hears about it, on which channel, and how often.
export const EVENT_TYPES = [
  "post.failed",
  "post.stuck",
  "post.skipped",
  "account.unresolved",
  "account.expired",
  "token.expiring",
  "ndb.broken",
  "billing.payment_failed",
  "trial.ending",
  "ops.quota_low",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type Channel = "email" | "notion" | "crisp" | "ops";

// subject: the thing the event is about (post id, sm_accs id, notion_dbs id); dedupe is per subject.
export type AppEvent = {type: EventType; uid: string; subject: string; data: Record<string, string | number | boolean>};

export type Route = {channels: readonly Channel[]; dedupeMs: number};

export type Delivery = {key: string; send: boolean; channels: readonly Channel[]};
