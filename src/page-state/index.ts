import {transition} from "xstate";
import {pageMachine} from "./machine";
import type {PageEvent, PageStateName, StoredPageState} from "./schema";

export {PAGE_STATES, SKIP_REASONS, type PageContext, type PageEvent, type PageStateName, type SkipReason, type StoredPageState, type Transition} from "./schema";

const KEEP_TRANSITIONS = 20;

export const initialPageState = (): StoredPageState => ({state: "draft", context: {}, version: 0, transitions: []});

export type Applied = {stored: StoredPageState; changed: boolean};

// Pure: the next stored state for one event. A move the machine refuses changes nothing.
export function applyPageEvent(stored: StoredPageState | undefined, event: PageEvent, now: number): Applied {
  const current = stored ?? initialPageState();
  const snapshot = pageMachine.resolveState({value: current.state, context: current.context});

  if (!snapshot.can(event)) return {stored: current, changed: false};

  const [next] = transition(pageMachine, snapshot, event);
  // SAFETY: pageMachine's states are flat, so the snapshot value is one of PAGE_STATES.
  const to = next.value as PageStateName;

  return {
    changed: true,
    stored: {
      state: to,
      context: next.context,
      version: current.version + 1,
      transitions: [...current.transitions, {from: current.state, to, event: event.type, at: now}].slice(-KEEP_TRANSITIONS),
    },
  };
}
