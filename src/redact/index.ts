// Masks secrets before a value reaches a log line (#105).
// The value goes through JSON; the masks run on the JSON text, so one set of patterns covers
// object keys, nested JSON strings, URL query strings, form bodies and Bearer tokens.

const SENSITIVE_KEYS = [
  "access_token",
  "refresh_token",
  "client_secret",
  "token",
  "secret",
  "password",
  "key",
  "api_key",
  "apikey",
  "authorization",
  "oauth_token",
  "oauth_token_secret",
  "fb_exchange_token",
  "code",
  "id_token",
].join("|");

// "key": "value" in JSON text.
const JSON_PAIR = new RegExp(`("(${SENSITIVE_KEYS})"\\s*:\\s*")((?:[^"\\\\]|\\\\.)*)(")`, "gi");

// \"key\": \"value\" in a JSON string nested inside JSON text.
const NESTED_JSON_PAIR = new RegExp(`(\\\\"(${SENSITIVE_KEYS})\\\\"\\s*:\\s*\\\\")([^"\\\\]*)(\\\\")`, "gi");

// key=value in a query string, form body or OAuth 1 header (oauth_token="...").
const PAIR = new RegExp(`(^|[?&;,\\s"'{])(${SENSITIVE_KEYS})=(\\\\?"|')?([^&\\s"',;#\\\\…]+)`, "gi");

// A token that a key-based mask has not already shortened.
const BEARER = /\b(Bearer)\s+([A-Za-z0-9\-._~+/]+=*)(?![A-Za-z0-9\-._~+/=…])/gi;

const SCHEME = /^(Bearer|Basic|OAuth)\s+/i;

// Error codes such as ERR_BAD_REQUEST or ECONNRESET are not OAuth codes; keep them readable.
const ERROR_CODE = /^[A-Z][A-Z0-9_]*$/;

const SHOWN = 4;

// First 4 chars + "…"; short values are hidden whole. A cut escape (`\`, `\u00`) is dropped
// so the JSON text stays valid.
function mask(secret: string): string {
  if (secret.length <= SHOWN * 2) return "…";

  return `${secret.slice(0, SHOWN).replace(/\\+(?:u[0-9a-fA-F]{0,3})?$/, "")}…`;
}

function maskValue(key: string, secret: string): string {
  if (key.toLowerCase() === "code" && ERROR_CODE.test(secret)) return secret;

  const scheme = SCHEME.exec(secret);

  if (scheme) return `${scheme[1]} ${mask(secret.slice(scheme[0].length))}`;

  return mask(secret);
}

function redactText(text: string): string {
  const pair = (_: string, head: string, key: string, secret: string, tail: string) =>
    `${head}${maskValue(key, secret)}${tail}`;

  return text
    .replace(JSON_PAIR, pair)
    .replace(NESTED_JSON_PAIR, pair)
    .replace(PAIR, (_, lead: string, key: string, quote: string | undefined, secret: string) =>
      `${lead}${key}=${quote ?? ""}${maskValue(key, secret)}`
    )
    .replace(BEARER, (_, word: string, token: string) => `${word} ${mask(token)}`);
}

type BufferJson = {type: "Buffer"; data: number[]};

type JsonInput = Error | ArrayBufferView | Partial<BufferJson> | null;

function isBufferJson(item: JsonInput): item is BufferJson {
  return item !== null && Object(item) === item && "type" in item && item.type === "Buffer" && Array.isArray(item.data);
}

// Prepares each value for JSON: errors keep name, message and stack; binary data becomes a
// size label; a repeated object becomes "<Circular>".
function jsonReplacer() {
  const seen = new WeakSet<object>();

  return (_key: string, item: JsonInput) => {
    if (Object(item) !== item || item === null) return item;

    if (isBufferJson(item)) return `<Buffer: ${item.data.length} Bytes>`;

    if (ArrayBuffer.isView(item)) return `<${item.constructor.name}: ${item.byteLength} Bytes>`;

    if (seen.has(item)) return "<Circular>";

    seen.add(item);

    if (item instanceof Error) return {...item, name: item.name, message: item.message, stack: item.stack};

    return item;
  };
}

/**
 * Returns a copy of `value` with secrets masked (first 4 chars + "…").
 * The copy is plain JSON data: errors become records with name, message, stack and own fields.
 */
export function redactSecrets<T>(value: T): T {
  const text = JSON.stringify(value, jsonReplacer());

  if (text === undefined) return value;

  // SAFETY: the text is JSON.stringify output with only string contents shortened, so it parses
  // back to the same shape; errors and binary data turn into plain records and labels.
  return JSON.parse(redactText(text)) as T;
}
