import {Context, Effect, Layer} from "effect";
import {PortFailed} from "./errors";
import type {Affiliate, AffiliateFields, DeleteOutput, Login, NewAffiliate, OwnedCollection, Subscription, UserFields} from "./schema";

// Each caller wires these to its own clients: functions with firebase-admin and the Stripe SDK,
// the admin Worker with REST clients. A port throws on failure; "not found" is undefined.
export type UserOpsPorts = {
  auth: {
    findByEmail: (email: string) => Promise<Login | undefined>;
    setEmail: (uid: string, email: string, verified: boolean) => Promise<void>;
    deleteLogin: (uid: string) => Promise<void>;
  };
  store: {
    getUser: (uid: string) => Promise<UserFields | undefined>;
    patchUser: (uid: string, fields: UserFields) => Promise<void>;
    deleteUser: (uid: string) => Promise<void>;
    deleteOwned: (collection: OwnedCollection, uid: string) => Promise<number>;
    createAffiliate: (linkName: string, doc: NewAffiliate) => Promise<"created" | "exists">;
    affiliatesOf: (uid: string) => Promise<Affiliate[]>;
    patchAffiliate: (id: string, fields: AffiliateFields) => Promise<void>;
    recordDeletion: (row: DeletionRow) => Promise<string>;
    finishDeletion: (id: string, result: DeleteOutput) => Promise<void>;
  };
  billing: {
    // Stripe customer owned by this uid: an exact metadata.firebaseUID match from a list by
    // email. Never Stripe search: it misses customers by region.
    findCustomer: (uid: string, email: string) => Promise<string | undefined>;
    deleteCustomer: (id: string) => Promise<void>;
    setCustomerEmail: (id: string, email: string) => Promise<void>;
    getSubscription: (id: string) => Promise<Subscription | undefined>;
    setTrialEnd: (id: string, trialEnd: number) => Promise<Subscription>;
    activePaypalSubs: (uid: string) => Promise<string[]>;
    cancelPaypalSub: (id: string) => Promise<void>;
  };
  crisp: {setContactEmail: (oldEmail: string, newEmail: string) => Promise<void>};
  receipt: {deleted: (uid: string, email: string) => Promise<void>};
};

// account_deletions/{id}: one row per delete, written before anything is removed.
export type DeletionRow = {uid: string; email: string; reason: string; detail: string | null; at: number};

type Lifted<T> = {readonly [K in keyof T]: T[K] extends (...args: infer A) => Promise<infer R> ? (...args: A) => Effect.Effect<R, PortFailed> : never};

type PromiseFn = (...args: never[]) => Promise<NonNullable<object> | string | number | boolean | void | undefined>;

function lift<T extends Record<string, PromiseFn>>(name: string, port: T): Lifted<T> {
  const entries = Object.entries(port).map(([key, fn]) => [
    key,
    (...args: never[]) => Effect.tryPromise({try: () => fn(...args), catch: (e) => new PortFailed({port: `${name}.${key}`, message: e instanceof Error ? e.message : String(e)})}),
  ]);

  // SAFETY: each entry wraps the port function of the same key, so the object matches Lifted<T>.
  return Object.fromEntries(entries) as Lifted<T>;
}

export class Auth extends Context.Service<Auth, Lifted<UserOpsPorts["auth"]>>()("UserOps/Auth") {}

export class Store extends Context.Service<Store, Lifted<UserOpsPorts["store"]>>()("UserOps/Store") {}

export class Billing extends Context.Service<Billing, Lifted<UserOpsPorts["billing"]>>()("UserOps/Billing") {}

export class Crisp extends Context.Service<Crisp, Lifted<UserOpsPorts["crisp"]>>()("UserOps/Crisp") {}

export class Receipt extends Context.Service<Receipt, Lifted<UserOpsPorts["receipt"]>>()("UserOps/Receipt") {}

export type UserOpsServices = Auth | Store | Billing | Crisp | Receipt;

export const portsLayer = (ports: UserOpsPorts): Layer.Layer<UserOpsServices> =>
  Layer.mergeAll(
    Layer.succeed(Auth, lift("auth", ports.auth)),
    Layer.succeed(Store, lift("store", ports.store)),
    Layer.succeed(Billing, lift("billing", ports.billing)),
    Layer.succeed(Crisp, lift("crisp", ports.crisp)),
    Layer.succeed(Receipt, lift("receipt", ports.receipt)),
  );
