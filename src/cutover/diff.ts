// Paths where two JSON-serialisable results differ, e.g. ["text", "media[1].url"].
export type Json = string | number | boolean | null | Json[] | {[key: string]: Json};

const MAX_PATHS = 20;

function isRecord(value: Json): value is {[key: string]: Json} {
  return Object(value) === value && !Array.isArray(value);
}

function walkArray(a: Json[], b: Json[], path: string, out: string[]): void {
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i++) walk(a[i] ?? null, b[i] ?? null, `${path}[${i}]`, out);
}

function walkRecord(a: {[key: string]: Json}, b: {[key: string]: Json}, path: string, out: string[]): void {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of keys) walk(a[key] ?? null, b[key] ?? null, path ? `${path}.${key}` : key, out);
}

function walk(a: Json, b: Json, path: string, out: string[]): void {
  if (out.length >= MAX_PATHS || JSON.stringify(a) === JSON.stringify(b)) return;

  if (Array.isArray(a) && Array.isArray(b)) return walkArray(a, b, path, out);

  if (isRecord(a) && isRecord(b)) return walkRecord(a, b, path, out);

  out.push(path || "(root)");
}

export function diffPaths(a: Json, b: Json): string[] {
  const out: string[] = [];

  walk(a, b, "", out);

  return out;
}
