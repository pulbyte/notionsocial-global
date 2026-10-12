import {Effect} from "effect";
import {StripeFailed} from "./errors";
import type {DeleteInput, DeleteOutput, OwnedCollection} from "./schema";
import {Auth, Billing, Receipt, Store} from "./service";

const OWNED: readonly OwnedCollection[] = ["sm_accs", "notion_dbs", "posts"];

// #40: record the reason, stop billing, delete data (sm_accs/notion_dbs deletes also remove vault
// tokens via the token mirror), delete the login, send a receipt. Billing goes first so a later
// failure never leaves a deleted user still being charged.
const stopBilling = (input: DeleteInput, custIdOnDoc: string | undefined) =>
  Effect.gen(function* () {
    const billing = yield* Billing;
    const {uid, email} = input.login;
    const custId = custIdOnDoc || (yield* billing.findCustomer(uid, email));

    if (custId) yield* billing.deleteCustomer(custId).pipe(Effect.mapError((e) => new StripeFailed({step: "deleteCustomer", message: e.message})));
    const subs = yield* billing.activePaypalSubs(uid);

    yield* Effect.forEach(subs, (sub) => billing.cancelPaypalSub(sub), {discard: true});

    return {custId, paypal: subs.length};
  });

const removeData = (uid: string, warnings: string[]) =>
  Effect.gen(function* () {
    const store = yield* Store;
    const deleted: Record<OwnedCollection, number> = {sm_accs: 0, notion_dbs: 0, posts: 0};

    for (const col of OWNED) {
      deleted[col] = yield* store.deleteOwned(col, uid).pipe(Effect.catch((e) => Effect.sync(() => (warnings.push(`${col}: ${e.message}`), -1))));
    }

    const userDocDeleted = yield* store.deleteUser(uid).pipe(
      Effect.as(true),
      Effect.catch((e) => Effect.sync(() => (warnings.push(`users: ${e.message}`), false))),
    );

    return {deleted, userDocDeleted};
  });

export const deleteAccount = (input: DeleteInput) =>
  Effect.gen(function* () {
    const {uid, email} = input.login;
    const store = yield* Store;
    const warnings: string[] = [];
    const user = yield* store.getUser(uid).pipe(Effect.catch((e) => Effect.sync(() => void warnings.push(`users read: ${e.message}`))));
    const id = yield* store.recordDeletion({uid, email, reason: input.reason, detail: input.detail?.slice(0, 1000) ?? null, at: Date.now()});

    const {custId, paypal} = yield* stopBilling(input, user?.billing?.cust_id);
    const {deleted, userDocDeleted} = yield* removeData(uid, warnings);

    const loginDeleted = yield* (yield* Auth).deleteLogin(uid).pipe(
      Effect.as(true),
      Effect.catch((e) => Effect.sync(() => (warnings.push(`auth: ${e.message}`), false))),
    );

    yield* (yield* Receipt).deleted(uid, email).pipe(Effect.catch((e) => Effect.sync(() => void warnings.push(`receipt: ${e.message}`))));
    const out: DeleteOutput = {uid, email, deleted, paypal, userDocDeleted, loginDeleted, warnings, ...(custId && {stripeCustId: custId})};

    yield* store.finishDeletion(id, out).pipe(Effect.ignore);

    return out;
  });
