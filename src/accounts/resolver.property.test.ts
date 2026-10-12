import fc from "fast-check";
import {expect, test} from "vitest";
import {aiAskable, resolveAccounts, type Account} from "./index";
import {tagOf} from "./match";

const platforms = ["instagram", "twitter", "linkedin", "facebook", "tiktok", "threads", "bluesky", "pinterest", "youtube"];

const account = fc.record({
  platform_uid: fc.stringMatching(/^[0-9a-z]{4,12}$/),
  platform: fc.constantFrom(...platforms),
  username: fc.stringMatching(/^[a-z][a-z0-9_.]{1,14}$/),
  acc_type: fc.option(fc.constantFrom("page", "group"), {nil: undefined}),
});

// Accounts with unique uids and unique tags, like one user's sm_accs.
const accountSet = fc.uniqueArray(account, {selector: (a) => a.platform_uid, maxLength: 8}).map((list) => {
  const seen = new Set<string>();

  return list.filter((a) => {
    const key = tagOf(a).toLowerCase();
    const fresh = !seen.has(key);

    seen.add(key);

    return fresh;
  });
});

test("every account's own tag resolves to that account (what the legacy lookup did)", () => {
  fc.assert(
    fc.property(accountSet, (accounts: Account[]) => {
      for (const a of accounts) {
        expect(resolveAccounts([tagOf(a)], accounts).resolved.map((r) => r.account.platform_uid)).toEqual([a.platform_uid]);
      }
    }),
  );
});

test("no value is dropped: alone, every value comes back resolved or unmatched, exactly once", () => {
  fc.assert(
    fc.property(accountSet, fc.string({maxLength: 30}), (accounts: Account[], value) => {
      const result = resolveAccounts([value], accounts);

      expect(result.resolved.length + result.unmatched.length).toBe(1);
    }),
  );
});

test("values in Notion tag shape always resolve or say why", () => {
  const tagLike = fc.tuple(fc.constantFrom("IG", "IN", "X", "TW", "LI", "LI-PAGE", "FB", "TT", "ZZ"), fc.stringMatching(/^[a-z][a-z0-9_.]{0,10}$/));

  fc.assert(
    fc.property(accountSet, tagLike, (accounts: Account[], [prefix, handle]) => {
      const result = resolveAccounts([`${prefix}@${handle}`], accounts);

      expect(result.resolved.length + result.unmatched.length).toBe(1);

      if (prefix === "ZZ") expect(result.unmatched[0]?.reason).toBe("unknown-platform");
    }),
  );
});

// #69: a group name resolves to exactly its connected members, or to an empty-group miss that
// later tiers may not try; it never becomes a single account picked by a looser rule.
test("a group name expands to exactly its connected members, whatever the accounts are called", () => {
  const groupName = fc.oneof(fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,20}$/), fc.constantFrom("acme", "acme_x"));

  fc.assert(
    fc.property(accountSet, groupName, fc.array(fc.nat(), {maxLength: 4}), (accounts: Account[], name, picks) => {
      const members = [...new Set(picks.map((i) => accounts[i % Math.max(accounts.length, 1)]?.platform_uid ?? "gone"))];
      const result = resolveAccounts([name], accounts, [], [{name, platform_uids: members}]);
      const live = members.filter((uid) => accounts.some((a) => a.platform_uid === uid));

      expect(result.resolved.map((r) => r.account.platform_uid).sort()).toEqual([...live].sort());
      expect(result.resolved.every((r) => r.rule === "group")).toBe(true);

      if (!live.length) expect(result.unmatched.map((m) => [m.reason, aiAskable(m)])).toEqual([["empty-group", false]]);
    }),
  );
});
