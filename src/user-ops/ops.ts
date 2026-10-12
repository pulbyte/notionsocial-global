import {Effect} from "effect";
import {AffiliateExists, AffiliateNotFound, AuthUpdateFailed, EmailTaken, NoSubscription, NotInTrial, SubscriptionCanceled, TrialAlreadyExtended, UserNotFound} from "./errors";
import type {
  EnrollInput,
  EnrollOutput,
  ExtendTrialInput,
  ExtendTrialOutput,
  LogPayoutInput,
  LogPayoutOutput,
  Payment,
  PayoutRequestOutput,
  UpdateEmailInput,
  UpdateEmailOutput,
} from "./schema";
import {Auth, Billing, Crisp, Store} from "./service";

const COMMISSION_RATE_DEFAULT = 20;

const DAY_S = 86_400;

// Self-serve extensions only revive a trial; a paid subscription never gets free days (#31).
const TRIAL_STATUSES = new Set(["trialing", "paused"]);

export const findLogin = (email: string) =>
  Effect.gen(function* () {
    const login = yield* (yield* Auth).findByEmail(email);

    return login ?? (yield* Effect.fail(new UserNotFound({email})));
  });

const warnOnFail = <A, E>(warnings: string[], label: string, effect: Effect.Effect<A, E>) =>
  effect.pipe(Effect.catch((e) => Effect.sync(() => void warnings.push(`${label}: ${String(e)}`))));

// Stripe and Crisp follow the login; their failures warn and leave the change in place.
export const syncAfterLogin = (uid: string, input: Pick<UpdateEmailInput, "oldEmail" | "newEmail">, warnings: string[]) =>
  Effect.gen(function* () {
    const user = yield* warnOnFail(warnings, `users/${uid}`, (yield* Store).getUser(uid));
    const billingCustId = user?.billing?.cust_id;

    if (!billingCustId) warnings.push(`users/${uid}: no billing.cust_id; skipping Stripe`);
    const stripeOk = !billingCustId || (yield* syncs(warnings, `stripe ${billingCustId}`, (yield* Billing).setCustomerEmail(billingCustId, input.newEmail)));
    const crispOk = yield* syncs(warnings, "crisp", (yield* Crisp).setContactEmail(input.oldEmail, input.newEmail));
    const partial: UpdateEmailOutput["partial"] = !stripeOk ? "stripe-failed" : !crispOk ? "crisp-sync-failed" : undefined;

    return {...(billingCustId && {billingCustId}), ...(partial && {partial})};
  });

// The login changes first; a failure there stops the op.
export const updateEmail = (input: UpdateEmailInput) =>
  Effect.gen(function* () {
    const warnings: string[] = [];
    const {uid} = yield* findLogin(input.oldEmail);
    const owner = yield* (yield* Auth).findByEmail(input.newEmail);

    if (owner && owner.uid !== uid) return yield* Effect.fail(new EmailTaken({email: input.newEmail}));
    yield* (yield* Auth).setEmail(uid, input.newEmail, input.verified).pipe(Effect.mapError((e) => new AuthUpdateFailed({message: e.message})));
    const synced = yield* syncAfterLogin(uid, input, warnings);
    const out: UpdateEmailOutput = {uid, oldEmail: input.oldEmail, newEmail: input.newEmail, warnings, ...synced};

    return out;
  });

const syncs = <E>(warnings: string[], label: string, effect: Effect.Effect<void, E>) =>
  effect.pipe(
    Effect.as(true),
    Effect.catch((e) => Effect.sync(() => (warnings.push(`${label}: ${String(e)}`), false))),
  );

// affiliate/{linkName} is the fail-stop write; the users flag after it only warns.
export const enrollAffiliate = (input: EnrollInput) =>
  Effect.gen(function* () {
    const warnings: string[] = [];
    const {uid} = yield* findLogin(input.email);
    const store = yield* Store;
    const existing = yield* store.affiliatesOf(uid);

    if (existing.length > 0) return yield* Effect.fail(new AffiliateExists({linkName: existing[0]?.id ?? input.linkName}));
    const link = `https://notionsocial.app?aref=${input.linkName}`;
    const referral = {free_count: 0, paid_count: 0, total_count: 0, total_value: 0};
    const doc = {author_uid: uid, commission_rate: COMMISSION_RATE_DEFAULT, id: input.linkName, link, payments: [], referral, total_payout: 0};

    if ((yield* store.createAffiliate(input.linkName, doc)) === "exists") return yield* Effect.fail(new AffiliateExists({linkName: input.linkName}));
    yield* warnOnFail(warnings, `users/${uid}`, store.patchUser(uid, {affiliate_partner: true}));
    const out: EnrollOutput = {uid, email: input.email, linkName: input.linkName, link, warnings};

    return out;
  });

const selfServeTrialCheck = (extendedAt: number | undefined, status: string) =>
  extendedAt
    ? Effect.fail(new TrialAlreadyExtended({at: extendedAt}))
    : TRIAL_STATUSES.has(status)
      ? Effect.void
      : Effect.fail(new NotInTrial({status}));

// Sets trial_end to now + days. A lapsed trial is "paused" (trials end with
// missing_payment_method: pause), and Stripe moves it back to "trialing"; canceled cannot move.
export const extendTrial = (input: ExtendTrialInput) =>
  Effect.gen(function* () {
    const warnings: string[] = [];
    const {uid} = yield* findLogin(input.email);
    const store = yield* Store;
    const user = yield* store.getUser(uid);
    const billing = user?.billing ?? {};
    const subId = billing.sub_id;

    if (!subId) return yield* Effect.fail(new NoSubscription({uid}));
    const previous = (yield* (yield* Billing).getSubscription(subId)) ?? (yield* Effect.fail(new NoSubscription({uid})));

    if (previous.status === "canceled") return yield* Effect.fail(new SubscriptionCanceled({subId}));

    if (input.selfServe) yield* selfServeTrialCheck(user?.trial_extended_at, previous.status);
    const newTrialEnd = Math.floor(Date.now() / 1000) + input.days * DAY_S;
    const updated = yield* (yield* Billing).setTrialEnd(subId, newTrialEnd);
    const synced = {...billing, status: updated.status, trial_end: updated.trial_end, start_at: updated.current_period_start, end_at: updated.current_period_end};

    // The customer.subscription.updated webhook re-syncs the same billing fields.
    yield* warnOnFail(warnings, `users/${uid} (webhook will re-sync)`, store.patchUser(uid, {billing: synced, trial_extended_at: Date.now()}));
    const out: ExtendTrialOutput = {uid, email: input.email, subId, days: input.days, previousStatus: previous.status, newStatus: updated.status, oldTrialEnd: previous.trial_end, newTrialEnd, warnings};

    return out;
  });

const affiliateOf = (uid: string, warnings: string[]) =>
  Effect.gen(function* () {
    const found = yield* (yield* Store).affiliatesOf(uid);


    if (found.length > 1) warnings.push(`affiliate: ${found.length} docs match author_uid=${uid}; using "${found[0]?.id}"`);

    return found[0] ?? (yield* Effect.fail(new AffiliateNotFound({uid})));
  });

// Support records a payout it made: one payments[] entry at the affiliate's current rate.
export const logAffiliatePayout = (input: LogPayoutInput) =>
  Effect.gen(function* () {
    const warnings: string[] = [];
    const {uid} = yield* findLogin(input.email);
    const affiliate = yield* affiliateOf(uid, warnings);
    const payment: Payment = {date: new Date().toISOString(), amount: input.amount, commission_rate: Number(affiliate.data.commission_rate ?? 0), note: input.note ?? ""};
    const newTotalPayout = Number(affiliate.data.total_payout ?? 0) + input.amount;

    yield* (yield* Store).patchAffiliate(affiliate.id, {payments: [...(affiliate.data.payments ?? []), payment], total_payout: newTotalPayout});
    const out: LogPayoutOutput = {uid, email: input.email, linkName: affiliate.id, payment, newTotalPayout, warnings};

    return out;
  });

// A user asks to be paid; support pays and then logs it with logAffiliatePayout.
export const requestPayout = (uid: string, amount: number) =>
  Effect.gen(function* () {
    const affiliate = yield* affiliateOf(uid, []);

    const out: PayoutRequestOutput = {uid, linkName: affiliate.id, amount};

    return out;
  });
