import {assign, setup} from "xstate";
import type {PageContext, PageEvent} from "./schema";

const scanMoves = {
  "scan.ready": {target: "scheduled", actions: "setTime"},
  "scan.queue": {target: "queued", actions: "setUntil"},
  "scan.skip": {target: "skipped", actions: "setReason"},
} as const;

// Every state and event of a page (#32). No I/O: the caller persists the snapshot.
export const pageMachine = setup({
  // SAFETY: XState reads these only as type carriers; the values are never used.
  types: {context: {} as PageContext, events: {} as PageEvent},
  actions: {
    setTime: assign(({event}) => ("at" in event ? {at: event.at, reason: undefined, until: undefined} : {})),
    setUntil: assign(({event}) => ("until" in event ? {until: event.until, reason: undefined} : {})),
    setReason: assign(({event}) => ("reason" in event ? {reason: event.reason} : {})),
    setResult: assign(({event}) => (event.type === "publish.done" ? {ok: event.ok, failed: event.failed} : {})),
    clear: assign(() => ({reason: undefined, at: undefined, until: undefined, ok: undefined, failed: undefined})),
  },
  guards: {
    allOk: ({event}) => event.type === "publish.done" && event.failed === 0 && event.ok > 0,
    allFailed: ({event}) => event.type === "publish.done" && event.ok === 0,
  },
}).createMachine({
  id: "page",
  initial: "draft",
  context: {},
  states: {
    // A postpone after a cancel re-schedules the page (#32 acceptance).
    draft: {on: {...scanMoves, postpone: {target: "scheduled", actions: "setTime"}}},
    skipped: {on: {...scanMoves, reset: {target: "draft", actions: "clear"}}},
    queued: {
      on: {
        "scan.ready": scanMoves["scan.ready"],
        "scan.skip": scanMoves["scan.skip"],
        cancel: {target: "draft", actions: "clear"},
        reset: {target: "draft", actions: "clear"},
      },
    },
    scheduled: {
      on: {
        "publish.start": "publishing",
        postpone: {target: "scheduled", actions: "setTime"},
        cancel: {target: "draft", actions: "clear"},
        "scan.skip": scanMoves["scan.skip"],
      },
    },
    publishing: {
      on: {
        "publish.retry": "scheduled",
        "publish.done": [
          {guard: "allOk", target: "published", actions: "setResult"},
          {guard: "allFailed", target: "failed", actions: "setResult"},
          {target: "partial", actions: "setResult"},
        ],
      },
    },
    published: {on: {reset: {target: "draft", actions: "clear"}}},
    partial: {on: {retry: "scheduled", reset: {target: "draft", actions: "clear"}}},
    failed: {on: {retry: "scheduled", reset: {target: "draft", actions: "clear"}}},
  },
});
