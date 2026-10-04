import {expect, test} from "vitest";
import {CACHE_MS, createCutover, type CutoverEvent, type Json} from "./index";

function fakeSource(doc: Readonly<Record<string, Json>> | undefined | Error) {
  const events: CutoverEvent[] = [];
  const state = {doc, now: 0, reads: 0};

  const cutover = createCutover({
    read: async () => {
      state.reads++;

      if (state.doc instanceof Error) throw state.doc;

      return state.doc;
    },
    report: (event) => events.push(event),
    now: () => state.now,
  });

  return {cutover, events, state};
}

const run = (extra: {next?: () => Promise<Json>; old?: () => Promise<Json>} = {}) => ({
  module: "resolver",
  uid: "u1",
  pageId: "p1",
  old: extra.old ?? (async () => ({account: "old"})),
  next: extra.next ?? (async () => ({account: "new"})),
});

test("off, missing module and missing doc use the old path", async () => {
  const docs: Array<Record<string, Json> | undefined> = [{resolver: {mode: "off"}}, {}, undefined];

  for (const doc of docs) {
    const {cutover, events} = fakeSource(doc);

    expect(await cutover(run())).toEqual({account: "old"});
    expect(events).toEqual([]);
  }
});

test("on uses the new path", async () => {
  const {cutover} = fakeSource({resolver: {mode: "on"}});

  expect(await cutover(run())).toEqual({account: "new"});
});

test("shadow returns old and reports a diff with ids", async () => {
  const {cutover, events} = fakeSource({resolver: {mode: "shadow"}});

  expect(await cutover(run())).toEqual({account: "old"});
  expect(events).toEqual([
    {name: "cutover.diff", module: "resolver", uid: "u1", page_id: "p1", mode: "shadow", paths: ["account"]},
  ]);
});

test("shadow compares through JSON: undefined fields and key order do not count", async () => {
  const {cutover, events} = fakeSource({resolver: {mode: "shadow"}});

  await cutover({...run(), old: async () => ({a: 1, b: 2}), next: async () => ({b: 2, a: 1, c: undefined})});
  expect(events).toEqual([]);
});

test("shadow with equal results reports nothing", async () => {
  const {cutover, events} = fakeSource({resolver: {mode: "shadow"}});

  await cutover(run({next: async () => ({account: "old"})}));
  expect(events).toEqual([]);
});

test("shadow: a crash in new code is reported and the user still gets old", async () => {
  const {cutover, events} = fakeSource({resolver: {mode: "shadow"}});

  expect(await cutover(run({next: () => Promise.reject(new Error("boom"))}))).toEqual({account: "old"});
  expect(events[0]).toMatchObject({name: "cutover.diff", paths: ["(new threw)"], error: "boom"});
});

test("shadow: an old-path error still reaches the caller", async () => {
  const {cutover} = fakeSource({resolver: {mode: "shadow"}});

  await expect(cutover(run({old: () => Promise.reject(new Error("old broke"))}))).rejects.toThrow("old broke");
});

test("new path crash falls back to old and is reported", async () => {
  const {cutover, events} = fakeSource({resolver: {mode: "allowlist", uids: ["u1"]}});

  expect(await cutover(run({next: () => Promise.reject(new Error("boom"))}))).toEqual({account: "old"});
  expect(events[0]).toMatchObject({name: "cutover.fallback", mode: "allowlist", error: "boom"});
});

test("an invalid doc turns every module off and is reported", async () => {
  const {cutover, events} = fakeSource({resolver: {mode: "sideways"}});

  expect(await cutover(run())).toEqual({account: "old"});
  expect(events[0]?.name).toBe("cutover.config_invalid");
});

test("an unreadable doc turns every module off and is reported", async () => {
  const {cutover, events} = fakeSource(new Error("firestore down"));

  expect(await cutover(run())).toEqual({account: "old"});
  expect(events[0]).toMatchObject({name: "cutover.config_invalid", error: "firestore down"});
});

test("config is read once per cache window; setting off applies after it", async () => {
  const {cutover, state} = fakeSource({resolver: {mode: "on"}});

  await cutover(run());
  state.doc = {resolver: {mode: "off"}};
  state.now = CACHE_MS - 1;
  expect(await cutover(run())).toEqual({account: "new"});
  state.now = CACHE_MS;
  expect(await cutover(run())).toEqual({account: "old"});
  expect(state.reads).toBe(2);
});
