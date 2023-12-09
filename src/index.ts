export const dev = process.env.NODE_ENV == 'development'

/**
 * Variant for the pricing.
 *
 * - `0`: Represents the initial pricing structure from the beginning.
 * - `1`: Represents the first update to pricing starting from January 1, 2024.
 *
 * The value of `PRICE_VARIENT` determines the version of the pricing plan used in the application.
 */
const PRICE_VARIENT = 1

const FREE_DESC = '1 Social account, 1 Notion database, 10 posts.'
const BASIC_DESC = '3 Social accounts, 1 Notion database, 30 posts, Post analytics, Publish actions, Reels, Stories & more.'
const PREMIUM_DESC = '10 Social accounts, 5 Notion databases, Unlimited posts, Post analytics, Publish actions, Live Support, Twitter, YouTube, TikTok, Pinterest, Threads, Documents, Reels, Stories & more.'

export type BillingPeriod = 'monthly' | 'yearly';
export type PricePlanLabel = 'free' | 'basic' | 'premium'

export interface PricingPlan {
    id:string;
    label: PricePlanLabel;
    period:BillingPeriod;
    notion_db_limit: number;
    sm_acc_limit: number;
    desc: string;
    amount:number;
}

export interface PlanByLabel {
  monthly:PricingPlan,
  yearly?:PricingPlan
  label:PricePlanLabel
}

const FREE_PRICES = {
  0: {
    monthly: {
      dev: 'price_1LsHTLSDUoOtEG2MAQCGBlTy',
      prod: 'price_1LsHKeSDUoOtEG2MS4ShbuTB',
      price: 0,
    },
  },
  1: {
    monthly: {
      dev: 'price_1LsHTLSDUoOtEG2MAQCGBlTy',
      prod: 'price_1LsHKeSDUoOtEG2MS4ShbuTB',
      price: 0,
    },
  },
}
const BASIC_PRICES = {
  0: {
    monthly: {
      dev: 'price_1Ls6ksSDUoOtEG2MkXhhwxGn',
      prod: 'price_1Ls6exSDUoOtEG2M5nX8imiN',
      price: 9,
    },
    yearly: {
      dev: 'price_1Ls6ksSDUoOtEG2MWdjojbJx',
      prod: 'price_1Ls6exSDUoOtEG2MmiMmiqxg',
      price: 79,
    },
  },
  1: {
    monthly: {
      dev: 'price_1OKhnGSDUoOtEG2MXO1kfO2o',
      prod: 'price_1OKdulSDUoOtEG2MUxXHY6mT',
      price: 15,
    },
    yearly: {
      dev: 'price_1OKhoVSDUoOtEG2MIGyPNvzh',
      prod: 'price_1OKdvaSDUoOtEG2MLmnDAcDV',
      price: 144,
    },
  },
}
const PREMIUM_PRICES = {
  0: {
    monthly: {
      dev: 'price_1Ls6lXSDUoOtEG2M4UYxrbX1',
      prod: 'price_1Ls6heSDUoOtEG2M2HAVTpV1',
      price: 15,
    },
    yearly: {
      dev: 'price_1Ls6lXSDUoOtEG2MXijEITgY',
      prod: 'price_1Ls6heSDUoOtEG2MQIdKCfqT',
      price: 129,
    },
  },
  1: {
    monthly: {
      dev: 'price_1OKdzDSDUoOtEG2MX8sMfWx4',
      prod: 'price_1OKFBjSDUoOtEG2MoBwhKZnZ',
      price: 25,
    },
    yearly: {
      dev: 'price_1OKdzPSDUoOtEG2M4IiqgPMg',
      prod: 'price_1OKdsfSDUoOtEG2MtDcMD8wH',
      price: 240,
    },
  },
}

const PLAN_IDS = {
  FREE_PLANS: FREE_PRICES,
  BASIC_PLANS: BASIC_PRICES,
  PREMIUM_PLANS: PREMIUM_PRICES,
}

function createPricingPlan(id, label:PricePlanLabel, period:BillingPeriod, notionDbLimit, smAccLimit, desc, price):PricingPlan {
  return {
    id,
    desc,
    label,
    period,
    notion_db_limit: notionDbLimit,
    sm_acc_limit: smAccLimit,
    amount: price,
  }
}
const createFreePricingPlan = (id) => createPricingPlan(id, 'free', 'monthly', 1, 1, FREE_DESC, 0)
const createBasicPricingPlan = (id, period:BillingPeriod, price) => createPricingPlan(id, 'basic', period, 1, 3, BASIC_DESC, price)
const createPremiumPricingPlan = (id, period:BillingPeriod, price) => createPricingPlan(id, 'premium', period, 5, 10, PREMIUM_DESC, price)
export const PRICING_PLANS:{[key:string]:PricingPlan} = {} as const;
const iterateAndCreatePlans = (prices, createPlanFn) => {
  Object.keys(prices).forEach((varient) => {
    const priceVarient = prices[varient];
    Object.keys(priceVarient).forEach((period) => {
      const devKey = priceVarient[period].dev;
      const prodKey = priceVarient[period].prod;
      const price = priceVarient[period].price;

      PRICING_PLANS[devKey] = createPlanFn(devKey, period, price);
      PRICING_PLANS[prodKey] = createPlanFn(prodKey, period, price);
    });
  });
};
iterateAndCreatePlans(FREE_PRICES, createFreePricingPlan);
iterateAndCreatePlans(BASIC_PRICES, createBasicPricingPlan);
iterateAndCreatePlans(PREMIUM_PRICES, createPremiumPricingPlan);

export type PRICING_PLAN_ID = keyof typeof PRICING_PLANS

export function getPlanId(label:PricePlanLabel, period:BillingPeriod) {
  const uppLabel = label.toUpperCase()
  return PLAN_IDS[`${uppLabel}_PLANS`][PRICE_VARIENT][period]?.[dev ? 'dev' : 'prod']
}

export function getPlanByLabel(label:PricePlanLabel):PlanByLabel {
  const mId = getPlanId(label, 'monthly')
  const yId = getPlanId(label, 'yearly')
  return {
    monthly: PRICING_PLANS[mId],
    ...yId && {yearly: PRICING_PLANS[yId]},
    label
  }
}

