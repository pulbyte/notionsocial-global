import {STRIPE_SUB_STATUS} from "./types";
import {dev} from "./env";
/**
 * Variant for the pricing.
 *
 * - `0`: Represents the initial pricing structure from the beginning.
 * - `1`: Represents the first update to pricing starting from January 1, 2024, (Updated 12 Dec 2023)
 *
 * The value of `PRICE_VARIANT` determines the version of the pricing plan used in the application.
 */
type PRICE_VARIANT = 0 | 1;
const PRICE_VARIANT: PRICE_VARIANT = 1;
export const freeMonthlyPostLimit = 10;
const FREE_DESC = "1 Social account, 1 Notion database, 10 posts.";
const BASIC_DESC =
  "3 Social accounts, 1 Notion database, Unlimited posts, Post analytics, Publish actions, Twitter, Pinterest, Threads, Reels, Stories & more.";
const PREMIUM_DESC =
  "10 Social accounts, 5 Notion databases, Unlimited posts, Post analytics, Publish actions, Live Support, Twitter, YouTube, TikTok, Pinterest, Threads, Documents, Reels, Stories & more.";

export type BillingPeriod = "monthly" | "yearly";
export type PricePlanLabel = "free" | "basic" | "premium";
type Platform =
  | "facebook-page"
  | "instagram"
  | "linkedin-profile"
  | "twitter"
  | "pinterest"
  | "linkedin-page"
  | "tiktok"
  | "youtube";
type SpecialPost = "reel" | "story" | "document" | "thread";
interface Features {
  smAccLimit: number;
  notionDbLimit: number;
  monthlyPosts: number;
  platforms: Platform[];
  dailyTwitterPosts?: number;
  publishActions: boolean;
  postMetrics: boolean;
  specialPosts?: SpecialPost[];
  imageSizeLimit: 5 | 30 | 50;
  videoSizeLimit: 80 | 200 | 500;
}
interface Price {
  monthly: {
    dev: string;
    prod: string;
    amount: number;
  };
  yearly?: {
    dev: string;
    prod: string;
    amount: number;
  };
  features: {
    smAccLimit: number;
    notionDbLimit: number;
    monthlyPosts: number;
    dailyTwitterPosts?: number;
    platforms: string[];
    postMetrics: boolean;
    publishActions: boolean;
    specialPosts?: SpecialPost[];
    imageSizeLimit: number;
    videoSizeLimit: number;
  };
  desc: string;
}
interface PriceVariants {
  0: Price;
  1: Price;
}
export interface PricingPlan {
  id: string;
  label: PricePlanLabel;
  period: BillingPeriod;
  notion_db_limit: number;
  sm_acc_limit: number;
  desc: string;
  amount: number;
  features: Features;
  variant: PRICE_VARIANT;
  live: boolean;
}

export interface PlanByLabel {
  monthly: PricingPlan;
  yearly?: PricingPlan;
  label: PricePlanLabel;
}

const FREE_PRICES: PriceVariants = {
  0: {
    monthly: {
      dev: "price_1LsHTLSDUoOtEG2MAQCGBlTy",
      prod: "price_1LsHKeSDUoOtEG2MS4ShbuTB",
      amount: 0,
    },
    features: {
      smAccLimit: 1,
      notionDbLimit: 1,
      monthlyPosts: 30,
      platforms: ["facebook-page", "instagram", "linkedin-profile"],
      postMetrics: false,
      publishActions: false,
      imageSizeLimit: 5,
      videoSizeLimit: 80,
    },
    desc: "1 Social account, 1 Notion database, 10 posts.",
  },
  1: {
    monthly: {
      dev: "price_1LsHTLSDUoOtEG2MAQCGBlTy",
      prod: "price_1LsHKeSDUoOtEG2MS4ShbuTB",
      amount: 0,
    },
    features: {
      smAccLimit: 1,
      notionDbLimit: 1,
      monthlyPosts: 30,
      platforms: ["facebook-page", "instagram", "linkedin-profile"],
      postMetrics: false,
      publishActions: false,
      imageSizeLimit: 5,
      videoSizeLimit: 80,
    },
    desc: "1 Social account, 1 Notion database, 10 posts.",
  },
};
const BASIC_PRICES: PriceVariants = {
  0: {
    monthly: {
      dev: "price_1Ls6ksSDUoOtEG2MkXhhwxGn",
      prod: "price_1Ls6exSDUoOtEG2M5nX8imiN",
      amount: 9,
    },
    yearly: {
      dev: "price_1Ls6ksSDUoOtEG2MWdjojbJx",
      prod: "price_1Ls6exSDUoOtEG2MmiMmiqxg",
      amount: 79,
    },
    features: {
      smAccLimit: 3,
      notionDbLimit: 1,
      monthlyPosts: -1,
      platforms: ["facebook-page", "instagram", "linkedin-profile"],
      publishActions: true,
      postMetrics: true,
      specialPosts: ["reel", "story", "document"],
      imageSizeLimit: 30,
      videoSizeLimit: 80,
    },
    desc: "3 Social accounts, 1 Notion database, Unlimited posts, Post analytics, Publish actions, Reels, Stories & more.",
  },
  1: {
    monthly: {
      dev: "price_1OKhnGSDUoOtEG2MXO1kfO2o",
      prod: "price_1OKdulSDUoOtEG2MUxXHY6mT",
      amount: 15,
    },
    yearly: {
      dev: "price_1OKhoVSDUoOtEG2MIGyPNvzh",
      prod: "price_1OKdvaSDUoOtEG2MLmnDAcDV",
      amount: 144,
    },
    features: {
      smAccLimit: 3,
      notionDbLimit: 1,
      monthlyPosts: -1,
      platforms: ["facebook-page", "instagram", "linkedin-profile", "twitter", "pinterest"],
      dailyTwitterPosts: -1,
      publishActions: true,
      postMetrics: true,
      specialPosts: ["reel", "story", "document", "thread"],
      imageSizeLimit: 30,
      videoSizeLimit: 80,
    },
    desc: "3 Social accounts, 1 Notion database, Unlimited posts, Post analytics, Publish actions, Twitter, Pinterest, Threads, Reels, Stories & more.",
  },
};
const PREMIUM_PRICES: PriceVariants = {
  0: {
    monthly: {
      dev: "price_1Ls6lXSDUoOtEG2M4UYxrbX1",
      prod: "price_1Ls6heSDUoOtEG2M2HAVTpV1",
      amount: 15,
    },
    yearly: {
      dev: "price_1Ls6lXSDUoOtEG2MXijEITgY",
      prod: "price_1Ls6heSDUoOtEG2MQIdKCfqT",
      amount: 129,
    },
    features: {
      smAccLimit: 10,
      notionDbLimit: 5,
      monthlyPosts: -1,
      platforms: [
        "facebook-page",
        "instagram",
        "linkedin-profile",
        "twitter",
        "pinterest",
        "linkedin-page",
        "tiktok",
        "youtube",
      ],
      dailyTwitterPosts: -1,
      publishActions: true,
      postMetrics: true,
      specialPosts: ["reel", "story", "document", "thread"],
      imageSizeLimit: 30,
      videoSizeLimit: 80,
    },
    desc: "10 Social accounts, 5 Notion databases, Unlimited posts, Post analytics, Publish actions, Live Support, Twitter, YouTube, TikTok, Pinterest, Threads, Documents, Reels, Stories & more.",
  },
  1: {
    monthly: {
      dev: "price_1OKdzDSDUoOtEG2MX8sMfWx4",
      prod: "price_1OKFBjSDUoOtEG2MoBwhKZnZ",
      amount: 25,
    },
    yearly: {
      dev: "price_1OKdzPSDUoOtEG2M4IiqgPMg",
      prod: "price_1OKdsfSDUoOtEG2MtDcMD8wH",
      amount: 240,
    },
    features: {
      smAccLimit: 10,
      notionDbLimit: 5,
      monthlyPosts: -1,
      platforms: [
        "facebook-page",
        "instagram",
        "linkedin-profile",
        "twitter",
        "pinterest",
        "linkedin-page",
        "tiktok",
        "youtube",
      ],
      dailyTwitterPosts: -1,
      publishActions: true,
      postMetrics: true,
      specialPosts: ["reel", "story", "document", "thread"],
      imageSizeLimit: 30,
      videoSizeLimit: 80,
    },
    desc: "10 Social accounts, 5 Notion databases, Unlimited posts, Post analytics, Publish actions, Live Support, Twitter, YouTube, TikTok, Pinterest, Threads, Documents, Reels, Stories & more.",
  },
};

const PLAN_IDS = {
  FREE_PLANS: FREE_PRICES,
  BASIC_PLANS: BASIC_PRICES,
  PREMIUM_PLANS: PREMIUM_PRICES,
};

function createPricingPlan(
  id,
  label: PricePlanLabel,
  period: BillingPeriod,
  variant,
  live,
  notionDbLimit,
  smAccLimit,
  desc,
  amount,
  features: Features
): PricingPlan {
  return {
    id,
    desc,
    label,
    period,
    notion_db_limit: notionDbLimit,
    sm_acc_limit: smAccLimit,
    amount,
    features,
    variant,
    live,
  };
}

export const PRICING_PLANS: {[key: string]: PricingPlan} = {} as const;
const iterateAndCreatePlans = (label: PricePlanLabel) => {
  const uppL = label.toUpperCase();
  const prices: PriceVariants = PLAN_IDS[`${uppL}_PLANS`];
  Object.keys(prices).forEach((variant) => {
    const priceVariant = prices[variant];
    Object.keys(priceVariant).forEach((key: BillingPeriod) => {
      const isPeriod = ["yearly", "monthly"].includes(key);
      if (isPeriod) {
        const p = priceVariant[key];
        const devKey = p.dev;
        const prodKey = p.prod;
        const amount = p.amount;
        const desc = priceVariant.desc;
        const features: Features = priceVariant.features;

        PRICING_PLANS[devKey] = createPricingPlan(
          devKey,
          label,
          key,
          Number(variant),
          false,
          features.notionDbLimit,
          features.smAccLimit,
          desc,
          amount,
          features
        );
        PRICING_PLANS[prodKey] = createPricingPlan(
          prodKey,
          label,
          key,
          Number(variant),
          true,
          features.notionDbLimit,
          features.smAccLimit,
          desc,
          amount,
          features
        );
      }
    });
  });
};
iterateAndCreatePlans("free");
iterateAndCreatePlans("basic");
iterateAndCreatePlans("premium");

export type PRICING_PLAN_ID = keyof typeof PRICING_PLANS;

export function getPlanId(
  label: PricePlanLabel,
  period: BillingPeriod,
  env?: "dev" | "prod",
  prVar?: PRICE_VARIANT
) {
  const uppLabel = label.toUpperCase();
  const v = prVar >= 0 ? prVar : PRICE_VARIANT;
  const e = env ? env : dev ? "dev" : "prod";
  return PLAN_IDS[`${uppLabel}_PLANS`][v][period]?.[e];
}

export function getPlanByLabel(
  label: PricePlanLabel,
  env?: "dev" | "prod",
  prVar?: PRICE_VARIANT
): PlanByLabel {
  const mId = getPlanId(label, "monthly", env, prVar);
  const yId = getPlanId(label, "yearly", env, prVar);
  return {
    monthly: PRICING_PLANS[mId],
    ...(yId && {yearly: PRICING_PLANS[yId]}),
    label,
  };
}

export function isSubscriptionActive(subStatus: STRIPE_SUB_STATUS) {
  return ["trialing", "active", "past_due"].includes(subStatus);
}
export function isPlanPaid(planId: PRICING_PLAN_ID) {
  const plan = PRICING_PLANS[planId]?.label;
  return ["premium", "basic"].includes(plan);
}
