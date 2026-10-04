import {handleMatches, kindOf, prefixTarget, splitValue, tagOf} from "./match";
import type {Account, Resolution, Resolved, Unmatched, WrittenTag} from "./schema";

type Outcome = Resolved | Unmatched;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const unmatched = (value: string, reason: Unmatched["reason"], candidates: Account[]): Unmatched => ({
  value,
  reason,
  candidates: candidates.map(tagOf),
});

// One account, or why not: ambiguous when several fit, no-account when none do.
function pick(value: string, found: Account[], rule: Resolved["rule"]): Outcome | undefined {
  const [first] = found;

  if (found.length === 1 && first) return {value, account: first, rule};

  return found.length > 1 ? unmatched(value, "ambiguous", found) : undefined;
}

// "LI@acme": the profile acme first; the page acme only when no profile fits (and vice versa).
function byPrefix(value: string, prefix: string, handle: string, accounts: Account[]): Outcome {
  const target = prefixTarget(prefix);

  if (!target) return unmatched(value, "unknown-platform", accounts);

  const onPlatform = accounts.filter((a) => a.platform === target.platform && handleMatches(a, handle));
  const wantedKind = target.kind === "any" ? "profile" : target.kind;
  const exactKind = onPlatform.filter((a) => kindOf(a) === wantedKind);

  return pick(value, exactKind, "alias") ?? pick(value, onPlatform, "alias") ?? unmatched(value, "no-account", accounts);
}

function byWrittenTag(value: string, accounts: Account[], written: readonly WrittenTag[]): Outcome | undefined {
  const uids = new Set(written.flatMap((w) => (same(w.tag, value) ? [w.platform_uid] : [])));

  return pick(value, accounts.filter((a) => uids.has(a.platform_uid)), "written_tag");
}

function resolveOne(value: string, accounts: Account[], written: readonly WrittenTag[]): Outcome {
  const byUid = pick(value, accounts.filter((a) => a.platform_uid === value.trim()), "platform_uid");
  const byWritten = byUid ?? byWrittenTag(value, accounts, written);
  const byTag = byWritten ?? pick(value, accounts.filter((a) => same(tagOf(a), value)), "tag");

  if (byTag) return byTag;

  const {prefix, handle} = splitValue(value);

  if (prefix) return byPrefix(value, prefix, handle, accounts);

  return pick(value, accounts.filter((a) => handleMatches(a, handle)), "handle") ?? unmatched(value, "no-account", accounts);
}

// sm_accs can hold the same account more than once (reconnects); keep the latest doc.
function latestPerUid(accounts: readonly Account[]): Account[] {
  const byUid = new Map<string, Account>();

  for (const account of accounts) {
    const kept = byUid.get(account.platform_uid);

    if (!kept || (account.last_updated_at ?? 0) > (kept.last_updated_at ?? 0)) byUid.set(account.platform_uid, account);
  }

  return [...byUid.values()];
}

// Exact tier of the account resolver (#17): every Platforms value either finds one of the
// user's live accounts or comes back unmatched with a reason. Nothing is dropped in silence.
export function resolveAccounts(
  values: readonly string[],
  accounts: readonly Account[],
  written: readonly WrittenTag[] = [],
): Resolution {
  const resolution: Resolution = {resolved: [], unmatched: []};
  const seen = new Set<string>();
  const live = latestPerUid(accounts);

  for (const value of values) {
    const outcome = resolveOne(value, live, written);

    if ("reason" in outcome) resolution.unmatched.push(outcome);
    else if (!seen.has(outcome.account.platform_uid)) {
      seen.add(outcome.account.platform_uid);
      resolution.resolved.push(outcome);
    }
  }

  return resolution;
}

// Page text for values that found no account (CONTEXT.md: Resolution).
export function unmatchedMessage(miss: Unmatched): string {
  const connected = miss.candidates.length ? miss.candidates.join(", ") : "none";

  const lead =
    miss.reason === "ambiguous"
      ? `"${miss.value}" matches more than one connected account`
      : `No connected account matches "${miss.value}"`;

  return `${lead}. Connected: ${connected}`;
}
