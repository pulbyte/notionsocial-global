import {dev} from "./env";
import {BillingPeriod, PRICE_VARIANT} from "./pricing";

export type PayPalPlanLabel = "basic" | "premium";
export type PayPalApiEnv = "sandbox" | "live";

/**
 * PayPal billing-plan ids, created by
 * backend/scripts/src/admin/setup-paypal-plans.ts (run once per environment).
 * Both environments use the custom-id product "notionsocial".
 * Variant 1 = current pricing (basic $15/$144, premium $25/$240 USD);
 * variant 0 = legacy pre-2024 pricing (basic $9/$79, premium $15/$129 USD) —
 * mirrors PRICING_PLANS in ./pricing.ts.
 */
export const PAYPAL_PLAN_IDS: Record<
  PayPalApiEnv,
  Record<PRICE_VARIANT, Record<PayPalPlanLabel, Record<BillingPeriod, string>>>
> = {
  sandbox: {
    0: {
      basic: {
        monthly: "P-7Y329588AK962671XNJZQZYY",
        yearly: "P-4LE01406GC664872VNJZQZZA",
      },
      premium: {
        monthly: "P-8N842914MV5487535NJZQZZI",
        yearly: "P-793105841C601230CNJZQZZQ",
      },
    },
    1: {
      basic: {
        monthly: "P-02A22592543775841NJZQZXQ",
        yearly: "P-44C78603UK982920RNJZQZXY",
      },
      premium: {
        monthly: "P-791135765G2223539NJZQZYA",
        yearly: "P-3X647860AB1532539NJZQZYQ",
      },
    },
  },
  live: {
    0: {
      basic: {
        monthly: "P-5AF90735LL952670FNJZQZSY",
        yearly: "P-5RF890921P985323GNJZQZTA",
      },
      premium: {
        monthly: "P-5GU06679EJ705633JNJZQZTA",
        yearly: "P-69669336P1776374XNJZQZTI",
      },
    },
    1: {
      basic: {
        monthly: "P-9X74653088576162GNJZQZSI",
        yearly: "P-8TT011887G263542MNJZQZSQ",
      },
      premium: {
        monthly: "P-0UT56854N21422213NJZQZSQ",
        yearly: "P-8C398191HR627462XNJZQZSY",
      },
    },
  },
};

/**
 * Reverse lookup: any PayPal plan id (sandbox or live, any variant) → which of
 * our plans it represents. PayPal plan ids are globally unique, so everything
 * coexists in one map; pair with getPlanId(label, period, undefined, variant)
 * to resolve the matching Stripe price id for the current environment.
 */
export const PAYPAL_PLAN_LABELS: Record<
  string,
  {label: PayPalPlanLabel; period: BillingPeriod; variant: PRICE_VARIANT}
> = {};
for (const env of ["sandbox", "live"] as PayPalApiEnv[]) {
  for (const variant of [0, 1] as PRICE_VARIANT[]) {
    for (const label of ["basic", "premium"] as PayPalPlanLabel[]) {
      for (const period of ["monthly", "yearly"] as BillingPeriod[]) {
        const id = PAYPAL_PLAN_IDS[env][variant][label][period];
        if (id) PAYPAL_PLAN_LABELS[id] = {label, period, variant};
      }
    }
  }
}

/**
 * Mirrors getPlanId(): resolves the PayPal plan id for the current (or given)
 * API environment and price variant (defaults to the current PRICE_VARIANT).
 */
export function getPayPalPlanId(
  label: PayPalPlanLabel,
  period: BillingPeriod,
  env?: PayPalApiEnv,
  prVar?: PRICE_VARIANT
) {
  const e = env ? env : dev ? "sandbox" : "live";
  const v = prVar >= 0 ? prVar : PRICE_VARIANT;
  return PAYPAL_PLAN_IDS[e][v][label][period];
}
