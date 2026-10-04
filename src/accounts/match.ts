import {prefixTarget, writtenPrefix, type Kind} from "./aliases";
import type {Account} from "./schema";

export function kindOf(account: Account): Kind {
  return account.acc_type === "page" || account.acc_type === "group" ? account.acc_type : "profile";
}

// The tag NotionSocial shows for an account, e.g. "LI-PAGE@acme" (text.ts getSmAccTag).
export function tagOf(account: Account): string {
  if (account.tag) return account.tag;

  const kind = kindOf(account);
  const suffix = kind === "profile" ? "" : `-${kind.toUpperCase()}`;

  return `${writtenPrefix(account.platform)}${suffix}@${account.username}`;
}

// Case, spaces and a leading @ never decide a match.
function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "").replace(/\s+/g, " ").toLowerCase();
}

export function handleMatches(account: Account, handle: string): boolean {
  const wanted = normalizeHandle(handle);
  const names = [account.username, account.handle].filter((name) => name !== undefined);

  return names.some((name) => normalizeHandle(name) === wanted);
}

export type ValueParts = {prefix?: string; handle: string};

// "LI-PAGE@acme" -> {prefix: "LI-PAGE", handle: "acme"} · "@acme" / "acme" -> {handle}
export function splitValue(value: string): ValueParts {
  const at = value.indexOf("@");

  if (at <= 0) return {handle: value};

  return {prefix: value.slice(0, at).trim(), handle: value.slice(at + 1)};
}

export {prefixTarget};
