// Page states and events (#32). One visible state per page; skipped always carries a reason.

export const PAGE_STATES = ["draft", "queued", "scheduled", "publishing", "published", "partial", "failed", "skipped"] as const;

export type PageStateName = (typeof PAGE_STATES)[number];

// Why the scan did not schedule a page (#48). Each one gets its own page text.
export const SKIP_REASONS = ["copied-row", "no-platforms", "wrong-status", "archived", "unresolved-account", "locked", "time-in-past"] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];

export type PageEvent =
  | {type: "scan.ready"; at: number} // passed every check; a task runs at `at`
  | {type: "scan.queue"; until: number} // more than 30 days out; the scan picks it up later
  | {type: "scan.skip"; reason: SkipReason}
  | {type: "postpone"; at: number}
  | {type: "cancel"}
  | {type: "publish.start"}
  | {type: "publish.retry"} // server error; the task runs again
  | {type: "publish.done"; ok: number; failed: number}
  | {type: "retry"} // re-publish a failed or partial page without clearing the property
  | {type: "reset"}; // the user cleared the NotionSocial property

export type PageContext = {
  reason?: SkipReason;
  at?: number;
  until?: number;
  ok?: number;
  failed?: number;
};

export type Transition = {from: PageStateName; to: PageStateName; event: PageEvent["type"]; at: number};

// What posts/{id} stores. version guards concurrent writers (Firestore transaction).
export type StoredPageState = {
  state: PageStateName;
  context: PageContext;
  version: number;
  transitions: Transition[];
};
