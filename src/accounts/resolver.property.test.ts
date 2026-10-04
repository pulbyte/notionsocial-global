import fc from "fast-check";
import {expect, test} from "vitest";
import {resolveAccounts, type Account} from "./index";
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
