import {expect, test} from "vitest";
import {aiAskable, resolveAccounts, unmatchedMessage, type Account} from "./index";

const ig: Account = {platform_uid: "17841", platform: "instagram", username: "ontherise.menswear"};

const x: Account = {platform_uid: "1946", platform: "twitter", username: "acme_x"};

const liPage: Account = {platform_uid: "90960", platform: "linkedin", username: "acme", acc_type: "page"};

const tt: Account = {platform_uid: "tt1", platform: "tiktok", username: "acme.tt"};

const th: Account = {platform_uid: "th1", platform: "threads", username: "acme.th"};

const accounts = [ig, x, liPage, tt, th];

const uidsFor = (values: string[], from: Account[] = accounts) =>
  resolveAccounts(values, from).resolved.map((r) => r.account.platform_uid);

test.each([
  ["IG@ontherise.menswear"],
  ["IN@ontherise.menswear"],
  ["INSTAGRAM@ontherise.menswear"],
  ["ig@OnTheRise.Menswear"],
  ["IN@@ontherise.menswear"],
])("%s resolves to the Instagram account", (value) => {
  expect(uidsFor([value])).toEqual(["17841"]);
});

test.each([["X@acme_x"], ["TW@acme_x"], ["TWITTER@acme_x"]])("%s resolves to the X account", (value) => {
  expect(uidsFor([value])).toEqual(["1946"]);
});

test.each([
  ["TT@acme.tt", "tt1"],
  ["TIKTOK@acme.tt", "tt1"],
  ["TH@acme.th", "th1"],
  ["THREADS@acme.th", "th1"],
])("%s resolves by alias", (value, uid) => {
  expect(uidsFor([value])).toEqual([uid]);
});

test("LI@acme reaches the LinkedIn page when no profile acme exists", () => {
  expect(resolveAccounts(["LI@acme"], accounts).resolved).toMatchObject([{account: liPage, rule: "alias"}]);
});

test("LI@acme prefers the profile when both a profile and a page are named acme", () => {
  const profile: Account = {platform_uid: "li-me", platform: "linkedin", username: "acme"};

  expect(uidsFor(["LI@acme"], [liPage, profile])).toEqual(["li-me"]);
  expect(uidsFor(["LI-PAGE@acme"], [liPage, profile])).toEqual(["90960"]);
});

test("the platform_uid and the stored tag match exactly", () => {
  const tagged: Account = {...x, tag: "TW@old_name"};

  expect(resolveAccounts(["1946"], accounts).resolved[0]?.rule).toBe("platform_uid");
  expect(resolveAccounts(["TW@old_name"], [tagged]).resolved[0]?.rule).toBe("tag");
});

test("a value with no account is unmatched with the connected list; the rest still resolve", () => {
  const result = resolveAccounts(["IG@someone_else", "X@acme_x"], accounts);

  expect(result.resolved.map((r) => r.account.platform_uid)).toEqual(["1946"]);
  expect(result.unmatched).toHaveLength(1);
  expect(unmatchedMessage(result.unmatched[0]!)).toBe(
    'No connected account matches "IG@someone_else". Connected: IN@ontherise.menswear, TW@acme_x, LI-PAGE@acme, TIKTOK@acme.tt, THREADS@acme.th',
  );
});

test("an unknown prefix and an ambiguous bare handle are unmatched with a reason", () => {
  const twin: Account = {platform_uid: "fb1", platform: "facebook", username: "acme_x"};
  const result = resolveAccounts(["MYSPACE@acme_x", "@acme_x"], [x, twin]);

  expect(result.unmatched.map((u) => u.reason)).toEqual(["unknown-platform", "ambiguous"]);
  expect(unmatchedMessage(result.unmatched[1]!)).toMatch(/^"@acme_x" matches more than one connected account/);
});

test("a bare handle unique across platforms resolves", () => {
  expect(resolveAccounts(["@acme.tt"], accounts).resolved).toMatchObject([{account: tt, rule: "handle"}]);
});

test("two values for the same account publish once", () => {
  expect(uidsFor(["IG@ontherise.menswear", "IN@ontherise.menswear"])).toEqual(["17841"]);
});

test("a written option name still finds its account after the account is renamed", () => {
  const renamed: Account = {platform_uid: "17841", platform: "instagram", username: "dbs.roofing"};
  const result = resolveAccounts(["IN@dbs48293"], [renamed], [{tag: "IN@dbs48293", platform_uid: "17841"}]);

  expect(result.resolved).toMatchObject([{account: renamed, rule: "written_tag"}]);
});

test("a written option name whose account is gone falls through to the live accounts", () => {
  const reconnected: Account = {platform_uid: "new-uid", platform: "threads", username: "acme.th"};
  const result = resolveAccounts(["THREADS@acme.th"], [reconnected], [{tag: "THREADS@acme.th", platform_uid: "old-uid"}]);

  expect(result.resolved).toMatchObject([{account: reconnected, rule: "tag"}]);
});

test("duplicate docs of one account are one account, the latest one", () => {
  const older: Account = {platform_uid: "17841", platform: "instagram", username: "ffpo.eu", last_updated_at: 1};
  const newer: Account = {...older, last_updated_at: 2, handle: "newer"};

  expect(resolveAccounts(["IN@ffpo.eu"], [older, newer]).resolved).toMatchObject([{account: newer}]);
});

const brandA = {name: "Brand A", platform_uids: ["1946", "17841", "90960"]};

const uidsForGroups = (values: string[], groups: {name: string; platform_uids: string[]}[]) =>
  resolveAccounts(values, accounts, [], groups).resolved.map((r) => r.account.platform_uid);

test("#69: a group option resolves to each member account, any case", () => {
  const result = resolveAccounts(["brand a"], accounts, [], [brandA]);

  expect(result.resolved.map((r) => [r.account.platform_uid, r.rule])).toEqual([
    ["17841", "group"],
    ["1946", "group"],
    ["90960", "group"],
  ]);
  expect(result.unmatched).toEqual([]);
});

test("#69: a member removed from the group is not resolved; a member also picked alone posts once", () => {
  const smaller = {...brandA, platform_uids: ["1946"]};

  expect(uidsForGroups(["Brand A"], [smaller])).toEqual(["1946"]);
  expect(uidsForGroups(["Brand A", "TW@acme_x"], [brandA])).toEqual(["17841", "1946", "90960"]);
});

test("#69: a group name wins over an account with the same handle", () => {
  expect(uidsForGroups(["acme_x"], [{name: "acme_x", platform_uids: ["17841"]}])).toEqual(["17841"]);
});

test("#69: a group with no connected member is unmatched, named, and not for the AI tier", () => {
  const result = resolveAccounts(["Brand A"], accounts, [], [{name: "Brand A", platform_uids: ["gone"]}]);
  const [miss] = result.unmatched;

  expect(result.resolved).toEqual([]);
  expect(miss?.reason).toBe("empty-group");
  expect(aiAskable(miss!)).toBe(false);
  expect(unmatchedMessage(miss!)).toMatch(/^Group "Brand A" has no connected accounts\. Connected: /);
});

test("aiAskable: unknown platforms and empty groups are not asked; other misses are", () => {
  const reasons = ["no-account", "ambiguous", "unknown-platform", "empty-group"] as const;

  expect(reasons.map((reason) => aiAskable({value: "v", reason, candidates: []}))).toEqual([true, true, false, false]);
});
