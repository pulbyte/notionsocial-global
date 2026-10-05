// Mapped Notion properties by id as well as name (#38): a rename in Notion no longer breaks a
// database. props: role -> property name (notion_dbs.props); meta: role -> {id, type}.
export type PropMeta = {id: string; type: string};

export type PropsMeta = Record<string, PropMeta>;

export type Schema = Record<string, {id: string; type: string}>; // data source properties by name

export type Healed = {
  props: Record<string, string>;
  meta: PropsMeta;
  renamed: Array<{role: string; from: string; to: string}>;
  missing: string[]; // roles whose property is gone (no name, no id match)
  changed: boolean;
};

// The current name of one mapped property: the same name, or the property with its stored id.
function currentName(name: string, knownId: string | undefined, schema: Schema, byId: Map<string, string>): string | undefined {
  if (schema[name]) return name;

  return knownId ? byId.get(knownId) : undefined;
}

type Step = {role: string; from: string; to: string | undefined};

// Pure: follow renames by id, refresh ids/types for names that still exist, list what is gone.
export function healProps(props: Record<string, string>, meta: PropsMeta | undefined, schema: Schema): Healed {
  const byId = new Map(Object.entries(schema).map(([name, p]) => [p.id, name]));

  const steps: Step[] = Object.entries(props)
    .filter(([, name]) => !!name)
    .map(([role, name]) => ({role, from: name, to: currentName(name, meta?.[role]?.id, schema, byId)}));

  const found = steps.filter((s): s is Step & {to: string} => s.to !== undefined);

  const metaOut = Object.fromEntries(
    found.flatMap((s) => {
      const p = schema[s.to];

      return p ? [[s.role, {id: p.id, type: p.type}]] : [];
    }),
  );

  return {
    props: {...props, ...Object.fromEntries(found.map((s) => [s.role, s.to]))},
    meta: metaOut,
    renamed: found.flatMap(({role, from, to}) => (to === from ? [] : [{role, from, to}])),
    missing: steps.flatMap((s) => (s.to === undefined ? [s.role] : [])),
    changed: found.some((s) => s.to !== s.from) || JSON.stringify(metaOut) !== JSON.stringify(meta ?? {}),
  };
}

// The filter type the scan must use for the Status property: native Notion Status or select.
export const statusFilterType = (meta: PropsMeta | undefined): "status" | "select" => (meta?.status?.type === "status" ? "status" : "select");
