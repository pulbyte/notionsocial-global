import {Schema} from "effect";

// Account actions a user runs from the app and support runs from the Crisp modal (#31).
export const USER_ACTIONS = ["delete", "update-email", "enroll-affiliate", "extend-trial", "payout-request", "limit-request"] as const;

export type UserAction = (typeof USER_ACTIONS)[number];

export const DELETE_REASONS = ["too_expensive", "not_useful", "hard_to_use", "missing_features", "switching", "other"] as const;

const Email = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/), Schema.isMaxLength(254));

// Used in the referral URL (?aref=<link>), so letters, digits, - and _ only.
const LinkName = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{2,40}$/));

// Request bodies of the self-serve routes (functions /account/*), decoded at the boundary.
export const DeleteBody = Schema.Struct({
  reason: Schema.Literals(DELETE_REASONS),
  detail: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(1000))),
});

export const UpdateEmailBody = Schema.Struct({email: Email});

export const EnrollAffiliateBody = Schema.Struct({linkName: LinkName});

export const PayoutRequestBody = Schema.Struct({
  amount: Schema.Finite.check(Schema.isBetween({minimum: 1, maximum: 100_000})),
  method: Schema.String.check(Schema.isMinLength(3), Schema.isMaxLength(500)),
});

export const LimitRequestBody = Schema.Struct({
  kind: Schema.Literals(["sm_accs", "notion_dbs"]),
  count: Schema.Int.check(Schema.isBetween({minimum: 1, maximum: 1000})),
});

export type DeleteBody = typeof DeleteBody.Type;

export type UpdateEmailBody = typeof UpdateEmailBody.Type;

export type EnrollAffiliateBody = typeof EnrollAffiliateBody.Type;

export type PayoutRequestBody = typeof PayoutRequestBody.Type;

export type LimitRequestBody = typeof LimitRequestBody.Type;

// The Firebase login an action runs for.
export type Login = {uid: string; email: string};

// users/{uid} fields the ops read. billing is written back whole by extendTrial, as before.
export type BillingFields = {cust_id?: string; sub_id?: string | null; status?: string; [field: string]: string | number | boolean | null | undefined};

export type UserFields = {billing?: BillingFields; affiliate_partner?: boolean; trial_extended_at?: number};

export type Subscription = {status: string; trial_end: number | null; current_period_start?: number | null; current_period_end?: number | null};

export type Payment = {date: string; amount: number; commission_rate: number; note: string};

export type AffiliateFields = {payments?: Payment[]; commission_rate?: number; total_payout?: number};

export type Affiliate = {id: string; data: AffiliateFields};

// affiliate/{linkName} as enrollAffiliate creates it (mirrors scripts/src/admin/affiliate.ts).
export type NewAffiliate = {
  author_uid: string;
  commission_rate: number;
  id: string;
  link: string;
  payments: Payment[];
  referral: {free_count: number; paid_count: number; total_count: number; total_value: number};
  total_payout: number;
};

export type OwnedCollection = "sm_accs" | "notion_dbs" | "posts";

export type UpdateEmailInput = {oldEmail: string; newEmail: string; verified: boolean};

export type UpdateEmailOutput = {
  uid: string;
  oldEmail: string;
  newEmail: string;
  billingCustId?: string;
  // Set when the login changed but a sync after it failed; the change still stands.
  partial?: "stripe-failed" | "crisp-sync-failed";
  warnings: string[];
};

export type DeleteInput = {login: Login; reason: string; detail?: string};

export type DeleteOutput = {
  uid: string;
  email: string;
  deleted: Record<OwnedCollection, number>;
  stripeCustId?: string;
  paypal: number;
  userDocDeleted: boolean;
  loginDeleted: boolean;
  warnings: string[];
};

export type EnrollInput = {email: string; linkName: string};

export type EnrollOutput = {uid: string; email: string; linkName: string; link: string; warnings: string[]};

// selfServe: once per user, and only while the subscription is in trial or paused.
export type ExtendTrialInput = {email: string; days: number; selfServe: boolean};

export type ExtendTrialOutput = {
  uid: string;
  email: string;
  subId: string;
  days: number;
  previousStatus: string;
  newStatus: string;
  oldTrialEnd: number | null;
  newTrialEnd: number;
  warnings: string[];
};

export type LogPayoutInput = {email: string; amount: number; note?: string};

export type LogPayoutOutput = {uid: string; email: string; linkName: string; payment: Payment; newTotalPayout: number; warnings: string[]};

export type PayoutRequestOutput = {uid: string; linkName: string; amount: number};
