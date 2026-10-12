import {Schema} from "effect";

const UtmValue = Schema.String.check(Schema.isMaxLength(200));

// UTM values; "{platform}" in a value becomes the Platform's name (x, linkedin, ...).
export const Utm = Schema.Struct({
  source: Schema.optionalKey(UtmValue),
  medium: Schema.optionalKey(UtmValue),
  campaign: Schema.optionalKey(UtmValue),
});

export type Utm = typeof Utm.Type;

// notion_dbs.link_tools, written by DB settings (#82).
export const LinkSettings = Schema.Struct({
  utm: Schema.optionalKey(Utm),
  shorten: Schema.optionalKey(Schema.Boolean),
});

export type LinkSettings = typeof LinkSettings.Type;

// What the caption renderer uses: UTM values for this Page and, when shortening is on, the
// short link for each tagged URL (tagged URL -> short URL).
export type LinkTools = {
  utm: Utm;
  short?: Readonly<Record<string, string>>;
};
