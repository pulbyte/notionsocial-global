import {expect, test} from "vitest";
import {createUserOps, decodeDeleteBody, decodeEnrollAffiliateBody, decodeExtendTrialBody, decodePayoutRequestBody, decodeUpdateEmailBody, type UserOpsPorts} from "./index";

type Calls = string[];

const fail = (what: string) => () => Promise.reject(new Error(what));

// In-memory ports: one user (uid-1, user@x.com) with a Stripe customer and a trialing subscription.
function ports(calls: Calls, over: Partial<{[K in keyof UserOpsPorts]: Partial<UserOpsPorts[K]>}> = {}): UserOpsPorts {
  const log = (call: string) => () => Promise.resolve(void calls.push(call));

  return {
    auth: {
      findByEmail: (email) => Promise.resolve(email === "user@x.com" ? {uid: "uid-1", email} : undefined),
      setEmail: log("auth.setEmail"),
      deleteLogin: log("auth.deleteLogin"),
      ...over.auth,
    },
    store: {
      getUser: () => Promise.resolve({billing: {cust_id: "cus_1", sub_id: "sub_1", plan_id: "basic"}}),
      patchUser: (_uid, fields) => Promise.resolve(void calls.push(`store.patchUser ${Object.keys(fields).join(",")}`)),
      deleteUser: log("store.deleteUser"),
      deleteOwned: (col) => Promise.resolve((calls.push(`store.deleteOwned ${col}`), 2)),
      createAffiliate: (link) => Promise.resolve((calls.push(`store.createAffiliate ${link}`), "created")),
      affiliatesOf: () => Promise.resolve([]),
      patchAffiliate: log("store.patchAffiliate"),
      recordDeletion: () => Promise.resolve((calls.push("store.recordDeletion"), "del-1")),
      finishDeletion: log("store.finishDeletion"),
      ...over.store,
    },
    billing: {
      findCustomer: () => Promise.resolve(undefined),
      deleteCustomer: log("billing.deleteCustomer"),
      setCustomerEmail: log("billing.setCustomerEmail"),
      getSubscription: () => Promise.resolve({status: "trialing", trial_end: 100}),
      setTrialEnd: (_id, end) => Promise.resolve({status: "trialing", trial_end: end, current_period_start: 1, current_period_end: end}),
      activePaypalSubs: () => Promise.resolve(["I-1"]),
      cancelPaypalSub: log("billing.cancelPaypalSub"),
      ...over.billing,
    },
    crisp: {setContactEmail: log("crisp.setContactEmail"), ...over.crisp},
    receipt: {deleted: log("receipt.deleted"), ...over.receipt},
  };
}

const login = {uid: "uid-1", email: "user@x.com"};

test("delete stops billing before any data goes, then removes data, login and sends a receipt", async () => {
  const calls: Calls = [];
  const r = await createUserOps(ports(calls)).deleteAccount({login, reason: "too_expensive"});

  expect(r).toMatchObject({ok: true, value: {stripeCustId: "cus_1", paypal: 1, loginDeleted: true, userDocDeleted: true, warnings: []}});
  expect(calls).toEqual([
    "store.recordDeletion",
    "billing.deleteCustomer",
    "billing.cancelPaypalSub",
    "store.deleteOwned sm_accs",
    "store.deleteOwned notion_dbs",
    "store.deleteOwned posts",
    "store.deleteUser",
    "auth.deleteLogin",
    "receipt.deleted",
    "store.finishDeletion",
  ]);
});

test("delete stops when Stripe fails, so no data is removed from a still-billed user", async () => {
  const calls: Calls = [];
  const r = await createUserOps(ports(calls, {billing: {deleteCustomer: fail("stripe 500")}})).deleteAccount({login, reason: "other"});

  expect(r).toMatchObject({ok: false, error: {code: "StripeFailed", step: "deleteCustomer"}});
  expect(calls).toEqual(["store.recordDeletion"]);
});

test("delete with a login already gone still clears data and reports a warning", async () => {
  const calls: Calls = [];
  const r = await createUserOps(ports(calls, {auth: {deleteLogin: fail("user-not-found")}, store: {getUser: () => Promise.resolve(undefined)}})).deleteAccount({login, reason: "admin"});

  expect(r).toMatchObject({ok: true, value: {loginDeleted: false, deleted: {sm_accs: 2, notion_dbs: 2, posts: 2}, warnings: ["auth: user-not-found"]}});
  expect(r.ok && r.value.stripeCustId).toBeUndefined();
});

test("update email changes the login, Stripe and Crisp", async () => {
  const calls: Calls = [];
  const r = await createUserOps(ports(calls)).updateEmail({oldEmail: "user@x.com", newEmail: "new@x.com", verified: false});

  expect(r).toMatchObject({ok: true, value: {uid: "uid-1", billingCustId: "cus_1"}});
  expect(r.ok && r.value.partial).toBeUndefined();
  expect(calls).toEqual(["auth.setEmail", "billing.setCustomerEmail", "crisp.setContactEmail"]);
});

test("update email refuses an address another login holds", async () => {
  const taken = ports([], {auth: {findByEmail: (email) => Promise.resolve({uid: email === "user@x.com" ? "uid-1" : "uid-2", email})}});
  const r = await createUserOps(taken).updateEmail({oldEmail: "user@x.com", newEmail: "other@x.com", verified: false});

  expect(r).toMatchObject({ok: false, error: {code: "EmailTaken"}});
});

test("update email reports a Stripe failure as partial; Stripe wins over Crisp", async () => {
  const both = ports([], {billing: {setCustomerEmail: fail("x")}, crisp: {setContactEmail: fail("y")}});
  const r = await createUserOps(both).updateEmail({oldEmail: "user@x.com", newEmail: "new@x.com", verified: true});

  expect(r).toMatchObject({ok: true, value: {partial: "stripe-failed"}});
});

test("update email for an unknown login fails with UserNotFound", async () => {
  const r = await createUserOps(ports([])).updateEmail({oldEmail: "nobody@x.com", newEmail: "new@x.com", verified: true});

  expect(r).toMatchObject({ok: false, error: {code: "UserNotFound", email: "nobody@x.com"}});
});

test("enroll creates the affiliate doc, then flags the user", async () => {
  const calls: Calls = [];
  const r = await createUserOps(ports(calls)).enrollAffiliate({email: "user@x.com", linkName: "coach"});

  expect(r).toMatchObject({ok: true, value: {link: "https://notionsocial.app?aref=coach"}});
  expect(calls).toEqual(["store.createAffiliate coach", "store.patchUser affiliate_partner"]);
});

test("enroll refuses a user who already has an affiliate link, and a taken link", async () => {
  const has = ports([], {store: {affiliatesOf: () => Promise.resolve([{id: "old", data: {}}])}});
  const taken = ports([], {store: {createAffiliate: () => Promise.resolve("exists")}});

  expect(await createUserOps(has).enrollAffiliate({email: "user@x.com", linkName: "coach"})).toMatchObject({ok: false, error: {code: "AffiliateExists", linkName: "old"}});
  expect(await createUserOps(taken).enrollAffiliate({email: "user@x.com", linkName: "coach"})).toMatchObject({ok: false, error: {code: "AffiliateExists", linkName: "coach"}});
});

test("extend trial moves trial_end and records the extension", async () => {
  const calls: Calls = [];
  const r = await createUserOps(ports(calls)).extendTrial({email: "user@x.com", days: 7, selfServe: true});

  expect(r).toMatchObject({ok: true, value: {subId: "sub_1", previousStatus: "trialing", oldTrialEnd: 100}});
  expect(calls).toEqual(["store.patchUser billing,trial_extended_at"]);
});

test("self-serve extend trial: once per user, and never on a paid subscription", async () => {
  const once = ports([], {store: {getUser: () => Promise.resolve({billing: {sub_id: "sub_1"}, trial_extended_at: 5})}});
  const paid = ports([], {billing: {getSubscription: () => Promise.resolve({status: "active", trial_end: null})}});

  expect(await createUserOps(once).extendTrial({email: "user@x.com", days: 7, selfServe: true})).toMatchObject({ok: false, error: {code: "TrialAlreadyExtended"}});
  expect(await createUserOps(paid).extendTrial({email: "user@x.com", days: 7, selfServe: true})).toMatchObject({ok: false, error: {code: "NotInTrial", status: "active"}});
  expect(await createUserOps(paid).extendTrial({email: "user@x.com", days: 7, selfServe: false})).toMatchObject({ok: true});
});

test("extend trial: no subscription and canceled are distinct failures", async () => {
  const none = ports([], {store: {getUser: () => Promise.resolve({})}});
  const canceled = ports([], {billing: {getSubscription: () => Promise.resolve({status: "canceled", trial_end: null})}});

  expect(await createUserOps(none).extendTrial({email: "user@x.com", days: 7, selfServe: false})).toMatchObject({ok: false, error: {code: "NoSubscription"}});
  expect(await createUserOps(canceled).extendTrial({email: "user@x.com", days: 7, selfServe: false})).toMatchObject({ok: false, error: {code: "SubscriptionCanceled"}});
});

test("payout log appends at the affiliate's rate; a request needs an affiliate", async () => {
  const aff = ports([], {store: {affiliatesOf: () => Promise.resolve([{id: "coach", data: {commission_rate: 30, total_payout: 10, payments: []}}])}});

  expect(await createUserOps(aff).logAffiliatePayout({email: "user@x.com", amount: 5})).toMatchObject({ok: true, value: {newTotalPayout: 15, payment: {commission_rate: 30}}});
  expect(await createUserOps(aff).requestPayout("uid-1", 40)).toEqual({ok: true, value: {uid: "uid-1", linkName: "coach", amount: 40}});
  expect(await createUserOps(ports([])).requestPayout("uid-1", 40)).toMatchObject({ok: false, error: {code: "AffiliateNotFound"}});
});

test("a port failure comes back as PortFailed naming the call", async () => {
  const r = await createUserOps(ports([], {auth: {findByEmail: fail("identitytoolkit 503")}})).findLogin("user@x.com");

  expect(r).toMatchObject({ok: false, error: {code: "PortFailed", port: "auth.findByEmail", message: "identitytoolkit 503"}});
});

test("bodies are decoded at the boundary", () => {
  expect(decodeDeleteBody({reason: "other"})).toEqual({reason: "other"});
  expect(() => decodeDeleteBody({reason: "bored"})).toThrow();
  expect(() => decodeUpdateEmailBody({email: "not an email"})).toThrow();
  expect(() => decodeEnrollAffiliateBody({linkName: "a b"})).toThrow();
  expect(() => decodePayoutRequestBody({amount: 0, method: "PayPal me@x.com"})).toThrow();
  expect(decodeExtendTrialBody({})).toEqual({});
  expect(() => decodeExtendTrialBody({feedback: "x".repeat(1001)})).toThrow();
});

// #41: self-serve email change waits for the Firebase verify link before Stripe and Crisp follow.
const pending = {from: "user@x.com", to: "new@x.com", at: 7};

test("request email change records it and changes no login, Stripe or Crisp", async () => {
  const calls: Calls = [];
  const r = await createUserOps(ports(calls)).requestEmailChange({login, newEmail: "new@x.com"});

  expect(r).toMatchObject({ok: true, value: {from: "user@x.com", to: "new@x.com"}});
  expect(calls).toEqual(["store.patchUser email_change"]);
});

test("request email change refuses an address another login holds", async () => {
  const calls: Calls = [];
  const taken = ports(calls, {auth: {findByEmail: (email) => Promise.resolve({uid: "uid-2", email})}});

  expect(await createUserOps(taken).requestEmailChange({login, newEmail: "other@x.com"})).toMatchObject({ok: false, error: {code: "EmailTaken"}});
  expect(calls).toEqual([]);
});

test("confirm email change: nothing pending, and link not opened yet, change nothing", async () => {
  const calls: Calls = [];
  const waiting = ports(calls, {store: {getUser: () => Promise.resolve({email_change: pending})}});

  expect(await createUserOps(ports(calls)).confirmEmailChange(login)).toEqual({ok: true, value: {state: "none", uid: "uid-1"}});
  expect(await createUserOps(waiting).confirmEmailChange(login)).toEqual({ok: true, value: {state: "waiting", uid: "uid-1"}});
  expect(calls).toEqual([]);
});

test("confirm email change after the link: Stripe and Crisp follow, then the record clears", async () => {
  const calls: Calls = [];
  const opened = ports(calls, {store: {getUser: () => Promise.resolve({billing: {cust_id: "cus_1"}, email_change: pending})}});
  const r = await createUserOps(opened).confirmEmailChange({uid: "uid-1", email: "New@x.com"});

  expect(r).toMatchObject({ok: true, value: {state: "synced", change: pending, billingCustId: "cus_1", warnings: []}});
  expect(calls).toEqual(["billing.setCustomerEmail", "crisp.setContactEmail", "store.patchUser email_change"]);
});
