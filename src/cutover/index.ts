import {cachedConfig, type ConfigSource} from "./config";
import {diffPaths, type Json} from "./diff";
import {route} from "./route";
import type {CutoverMode} from "./schema";

export {CACHE_MS, type ConfigSource} from "./config";

export {bucket, route} from "./route";

export {diffPaths, type Json} from "./diff";

export type {CutoverEvent} from "./schema";

export type CutoverRun<T> = {
  module: string;
  uid: string;
  pageId?: string;
  old: () => Promise<T>;
  next: () => Promise<T>;
};

// Results are compared as they would be stored or sent: through JSON.
function toJson<T>(value: T): Json {
  // SAFETY: JSON.parse of JSON.stringify output is always a Json value.
  return JSON.parse(JSON.stringify(value) ?? "null") as Json;
}

const message = (reason: Error | string) => (reason instanceof Error ? reason.message : String(reason));

// Runs the old or new path for one request per config/cutover (SAFE-CHANGES.md).
// In shadow mode both run and the old result is returned, so `next` must have no side effects.
export function createCutover(source: ConfigSource) {
  const config = cachedConfig(source);

  return async function cutover<T>(run: CutoverRun<T>): Promise<T> {
    const sw = (await config())[run.module];
    const mode: CutoverMode = sw?.mode ?? "off";
    const event = {module: run.module, uid: run.uid, page_id: run.pageId, mode};
    const path = route(run.module, run.uid, sw);

    if (path === "old") return run.old();

    if (path === "new") {
      // A crash in new code falls back to the old path for this request and is reported.
      return run.next().catch((error: Error) => {
        source.report({...event, name: "cutover.fallback", error: message(error)});

        return run.old();
      });
    }

    const [old, next] = await Promise.allSettled([run.old(), run.next()]);

    if (next.status === "rejected") {
      source.report({...event, name: "cutover.diff", paths: ["(new threw)"], error: message(next.reason)});
    } else if (old.status === "fulfilled") {
      const paths = diffPaths(toJson(old.value), toJson(next.value));

      if (paths.length) source.report({...event, name: "cutover.diff", paths});
    }

    if (old.status === "rejected") throw old.reason;

    return old.value;
  };
}

export type Cutover = ReturnType<typeof createCutover>;
