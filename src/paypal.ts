import {dev} from "./env";
import {BillingPeriod, PRICE_VARIANT} from "./pricing";

export type PayPalPlanLabel = "basic" | "premium";
export type PayPalApiEnv = "sandbox" | "live";

/**
 * PayPal billing-plan ids, created by
 * backend/scripts/src/admin/setup-paypal-plans.ts (run once per environment).
 * Sandbox product: PROD-06X977198U0867206 · Live product: PROD-6C188532WM155205R
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
        monthly: "P-0JB280131P8402545NJZQWSY",
        yearly: "P-42B604269W338854KNJZQWTA",
      },
      premium: {
        monthly: "P-28242562457049356NJZQWTI",
        yearly: "P-7VR40234NX001921GNJZQWTY",
      },
    },
    1: {
      basic: {
        monthly: "P-3F6631417M235690RNJZQUMA",
        yearly: "P-22N71347U65763154NJZQUMQ",
      },
      premium: {
        monthly: "P-0JK089259M097533BNJZQUMY",
        yearly: "P-57L539444U3739027NJZQUNA",
      },
    },
  },
  live: {
    0: {
      basic: {
        monthly: "P-0EA98326AG747284PNJZQWVA",
        yearly: "P-5ND96678DK2115521NJZQWVI",
      },
      premium: {
        monthly: "P-08K51027UK059051VNJZQWVI",
        yearly: "P-8SR58330BP966130NNJZQWVQ",
      },
    },
    1: {
      basic: {
        monthly: "P-7PC89076KP891112HNJZQUPA",
        yearly: "P-9LT713455H692541SNJZQUPA",
      },
      premium: {
        monthly: "P-6EU83786A0727954TNJZQUPI",
        yearly: "P-2DW95920TY964920LNJZQUPI",
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
