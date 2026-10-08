import type {AppEvent, Delivery, EventType, Route} from "./schema";

export {EVENT_TYPES, type AppEvent, type Channel, type Delivery, type EventType, type Route} from "./schema";

const HOUR = 3_600_000;

const DAY = 24 * HOUR;

// One rule per event type. dedupeMs: the same event for the same subject inside this window is
// recorded but not sent again (one user got 19 'access invalid' emails in a week before this).
export const ROUTES: Record<EventType, Route> = {
  "post.failed": {channels: ["email"], dedupeMs: DAY},
  "post.stuck": {channels: ["email"], dedupeMs: DAY},
  "post.skipped": {channels: ["notion"], dedupeMs: DAY},
  "account.unresolved": {channels: ["notion"], dedupeMs: DAY},
  "account.expired": {channels: ["email"], dedupeMs: 7 * DAY},
  "token.expiring": {channels: ["email"], dedupeMs: 7 * DAY},
  "ndb.broken": {channels: ["email"], dedupeMs: 3 * DAY},
  // #40: the receipt after a self-serve delete; one per account.
  "account.deleted": {channels: ["email"], dedupeMs: DAY},
  // #109: the welcome email once per user; the checkout reminder at most every 3 days.
  "user.welcome": {channels: ["email"], dedupeMs: 365 * DAY},
  "billing.checkout_incomplete": {channels: ["email"], dedupeMs: 3 * DAY},
  "billing.payment_failed": {channels: ["email"], dedupeMs: 3 * DAY},
  "trial.ending": {channels: ["email"], dedupeMs: 30 * DAY},
  "ops.quota_low": {channels: ["ops"], dedupeMs: 6 * HOUR},
};

export const dedupeKey = (e: AppEvent) => `${e.type}:${e.uid}:${e.subject}`;

// Pure: send now, or skip because the same key was sent inside the window.
export function planDelivery(e: AppEvent, lastSentAt: number | undefined, now: number): Delivery {
  const route = ROUTES[e.type];
  const send = lastSentAt === undefined || now - lastSentAt >= route.dedupeMs;

  return {key: dedupeKey(e), send, channels: route.channels};
}
