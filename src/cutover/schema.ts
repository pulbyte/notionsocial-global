import {Schema} from "effect";

// Firestore config/cutover: {"<module>": {mode, uids?, percent?}} (backend docs/standards/live-changes.md).
export const CutoverMode = Schema.Literals(["off", "shadow", "allowlist", "percent", "on"]);

export type CutoverMode = typeof CutoverMode.Type;

export const ModuleSwitch = Schema.Struct({
  mode: CutoverMode,
  uids: Schema.optionalKey(Schema.Array(Schema.String)),
  percent: Schema.optionalKey(Schema.Finite.check(Schema.isBetween({minimum: 0, maximum: 100}))),
});

export type ModuleSwitch = typeof ModuleSwitch.Type;

export const CutoverConfig = Schema.Record(Schema.String, ModuleSwitch);

export type CutoverConfig = typeof CutoverConfig.Type;

export type CutoverEvent = {
  name: "cutover.diff" | "cutover.fallback" | "cutover.config_invalid";
  module: string;
  uid: string;
  page_id?: string;
  mode: CutoverMode;
  paths?: string[];
  error?: string;
};
