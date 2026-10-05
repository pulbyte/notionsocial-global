import fc from "fast-check";
import {expect, test} from "vitest";
import {applyPageEvent, initialPageState, PAGE_STATES, type PageEvent, type PageStateName, SKIP_REASONS, type StoredPageState} from "./index";

const sample: Record<PageEvent["type"], PageEvent> = {
  "scan.ready": {type: "scan.ready", at: 100},
  "scan.queue": {type: "scan.queue", until: 200},
  "scan.skip": {type: "scan.skip", reason: "copied-row"},
  postpone: {type: "postpone", at: 300},
  cancel: {type: "cancel"},
  "publish.start": {type: "publish.start"},
  "publish.retry": {type: "publish.retry"},
  "publish.done": {type: "publish.done", ok: 2, failed: 0},
  "publish.fail": {type: "publish.fail", code: "inactive-subscription"},
  retry: {type: "retry"},
  reset: {type: "reset"},
};

// The whole table: every state x event. Missing entries are refused moves.
const allowed: Record<PageStateName, Partial<Record<PageEvent["type"], PageStateName>>> = {
  draft: {"scan.ready": "scheduled", "scan.queue": "queued", "scan.skip": "skipped", postpone: "scheduled"},
  skipped: {"scan.ready": "scheduled", "scan.queue": "queued", "scan.skip": "skipped", reset: "draft"},
  queued: {"scan.ready": "scheduled", "scan.skip": "skipped", cancel: "draft", reset: "draft"},
  scheduled: {"publish.start": "publishing", "publish.fail": "failed", postpone: "scheduled", cancel: "draft", "scan.skip": "skipped"},
  publishing: {"publish.retry": "scheduled", "publish.done": "published", "publish.fail": "failed"},
  published: {reset: "draft"},
  partial: {retry: "scheduled", reset: "draft"},
  failed: {retry: "scheduled", reset: "draft"},
};

const at = (state: PageStateName): StoredPageState => ({...initialPageState(), state, context: {}});

for (const state of PAGE_STATES) {
  test(`${state}: allowed moves land where the table says, others change nothing`, () => {
    for (const [type, event] of Object.entries(sample)) {
      const {stored, changed} = applyPageEvent(at(state), event, 1);
      // SAFETY: the keys of `sample` are exactly the event types.
      const want = allowed[state][type as PageEvent["type"]];
      expect([type, changed, changed ? stored.state : undefined]).toEqual([type, !!want, want]);

      if (!want) expect(stored).toEqual(at(state));
    }
  });
}

test("publish.done picks published, partial or failed from the counts", () => {
  const done = (ok: number, failed: number) => applyPageEvent(at("publishing"), {type: "publish.done", ok, failed}, 1).stored;
  expect([done(2, 0).state, done(1, 1).state, done(0, 2).state]).toEqual(["published", "partial", "failed"]);
  expect(done(1, 1).context).toMatchObject({ok: 1, failed: 1});
});

test("a cancelled then postponed page ends scheduled with both transitions recorded", () => {
  let s = applyPageEvent(at("scheduled"), {type: "cancel"}, 1).stored;
  s = applyPageEvent(s, {type: "postpone", at: 500}, 2).stored;
  expect(s.state).toBe("scheduled");
  expect(s.context.at).toBe(500);
  expect(s.transitions.map((t) => `${t.from}>${t.to}:${t.event}`)).toEqual(["scheduled>draft:cancel", "draft>scheduled:postpone"]);
});

const event = fc.oneof(
  fc.integer().map((n): PageEvent => ({type: "scan.ready", at: n})),
  fc.integer().map((n): PageEvent => ({type: "scan.queue", until: n})),
  fc.constantFrom(...SKIP_REASONS).map((reason): PageEvent => ({type: "scan.skip", reason})),
  fc.integer().map((n): PageEvent => ({type: "postpone", at: n})),
  fc.record({ok: fc.nat(5), failed: fc.nat(5)}).map((r): PageEvent => ({type: "publish.done", ...r})),
  fc.string().map((code): PageEvent => ({type: "publish.fail", code})),
  fc.constantFrom<PageEvent>({type: "cancel"}, {type: "publish.start"}, {type: "publish.retry"}, {type: "retry"}, {type: "reset"}),
);

test("any event sequence ends in a legal state; refused moves change nothing; version counts moves", () => {
  fc.assert(
    fc.property(fc.array(event, {maxLength: 60}), (events) => {
      let s = initialPageState();
      let moves = 0;
      events.forEach((e, i) => {
        const r = applyPageEvent(s, e, i);

        if (!r.changed) expect(r.stored).toBe(s);
        else moves++;
        s = r.stored;
        expect(PAGE_STATES).toContain(s.state);

        if (s.state === "skipped") expect(SKIP_REASONS).toContain(s.context.reason);
      });
      expect(s.version).toBe(moves);
      expect(s.transitions.length).toBe(Math.min(moves, 20));
    }),
  );
});

test("the same skip reason on a skipped page changes nothing; a new reason is a move", () => {
  const first = applyPageEvent(undefined, {type: "scan.skip", reason: "wrong-status"}, 1).stored;
  const again = applyPageEvent(first, {type: "scan.skip", reason: "wrong-status"}, 2);
  const other = applyPageEvent(first, {type: "scan.skip", reason: "no-platforms"}, 3);

  expect([again.changed, again.stored.version]).toEqual([false, 1]);
  expect([other.changed, other.stored.context.reason]).toEqual([true, "no-platforms"]);
});
