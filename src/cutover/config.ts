import {Schema} from "effect";
import type {Json} from "./diff";
import {CutoverConfig, type CutoverEvent} from "./schema";

export const CACHE_MS = 60_000;

export type ConfigSource = {
  read: () => Promise<Readonly<Record<string, Json>> | undefined>;
  report: (event: CutoverEvent) => void;
  now: () => number;
};

const decode = Schema.decodeUnknownExit(CutoverConfig);

// Reads config/cutover at most once per CACHE_MS. A missing, unreadable or invalid doc means
// every module is off, so a bad edit sends users to the old path, never to untested code.
export function cachedConfig(source: ConfigSource): () => Promise<CutoverConfig> {
  let cached: {at: number; config: Promise<CutoverConfig>} | undefined;

  const load = async (): Promise<CutoverConfig> => {
    const raw = await source.read().catch((error: Error) => error);
    const exit = raw instanceof Error ? undefined : decode(raw ?? {});

    if (exit?._tag === "Success") return exit.value;

    const error = raw instanceof Error ? raw.message : String(exit?.cause);

    source.report({name: "cutover.config_invalid", module: "*", uid: "", mode: "off", error});

    return {};
  };

  return () => {
    const now = source.now();

    if (!cached || now - cached.at >= CACHE_MS) cached = {at: now, config: load()};

    return cached.config;
  };
}
