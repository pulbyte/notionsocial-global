import type {CutoverMode, ModuleSwitch} from "./schema";

// Which path serves this request: the old code, the new code, or old with new beside it.
export type Route = "old" | "new" | "shadow";

// FNV-1a: the same uid lands in the same bucket on every request and every instance.
export function bucket(module: string, uid: string): number {
  let hash = 0x811c9dc5;

  for (const char of `${module}:${uid}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash % 100;
}

function listed(uid: string, sw: ModuleSwitch): boolean {
  return sw.uids?.includes(uid) ?? false;
}

const routes: Record<CutoverMode, (module: string, uid: string, sw: ModuleSwitch) => Route> = {
  off: () => "old",
  shadow: () => "shadow",
  on: () => "new",
  allowlist: (_module, uid, sw) => (listed(uid, sw) ? "new" : "old"),
  percent: (module, uid, sw) => (listed(uid, sw) || bucket(module, uid) < (sw.percent ?? 0) ? "new" : "old"),
};

export function route(module: string, uid: string, sw: ModuleSwitch | undefined): Route {
  return sw ? routes[sw.mode](module, uid, sw) : "old";
}
