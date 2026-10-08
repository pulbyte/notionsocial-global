import {freeMonthlyPostLimit, PRICING_PLANS, type PricePlanLabel, type PricingPlan} from "../pricing";

// One answer to "may this user do X" (#30). v1 reproduces today's backend rules exactly;
// changes to the rules land here as separate, named commits.
export type Entitlements = {
  planId: string | null;
  label: PricePlanLabel | "none";
  active: boolean; // subscription status trialing | active | past_due
  paid: boolean; // basic or premium plan, whatever the status (as publish reads it today)
  trial: {endsAt: number | null; used: boolean};
  limits: {
    smAccs: number; // plan limit (1 without a plan) + add-on increments
    notionDbs: number;
    postsPerMonth: number | null; // null = unlimited
    postsGrace: number; // publish blocks at postsPerMonth + postsGrace
    imageMB: number; // per-file cap from the plan (#108); free caps without a plan
    videoMB: number;
  };
  flags: {stories: boolean; reels: boolean; igVideo: boolean; postProcess: boolean; waitForProcessing: boolean};
};

// UserData satisfies this; kept loose so callers and tests need no casts.
export type EntitlementsInput = {
  billing?: {plan_id?: string | number | null; status?: string | null; trial_end?: number; trial_used?: boolean};
  sm_acc_limit_incr?: number;
  notion_db_limit_incr?: number;
};

const POSTS_GRACE = 2;

const FREE_PLAN = Object.values(PRICING_PLANS).find((p) => p.label === "free");

const ACTIVE_STATUSES = new Set(["trialing", "active", "past_due"]); // = isSubscriptionActive

const PAID_LABELS = new Set(["basic", "premium"]); // = isPlanPaid

function planOf(user: EntitlementsInput | undefined) {
  const planId = user?.billing?.plan_id ?? null;

  return {planId: planId === null ? null : String(planId), plan: planId === null ? undefined : PRICING_PLANS[planId]};
}

function mediaCapsOf(plan: PricingPlan | undefined) {
  const features = (plan ?? FREE_PLAN)?.features;

  return {imageMB: features?.imageSizeLimit ?? 5, videoMB: features?.videoSizeLimit ?? 50};
}

function limitsOf(user: EntitlementsInput | undefined, plan: PricingPlan | undefined, paid: boolean): Entitlements["limits"] {
  return {
    smAccs: (plan?.sm_acc_limit || 1) + (user?.sm_acc_limit_incr || 0),
    notionDbs: (plan?.notion_db_limit || 1) + (user?.notion_db_limit_incr || 0),
    postsPerMonth: paid ? null : freeMonthlyPostLimit,
    postsGrace: POSTS_GRACE,
    ...mediaCapsOf(plan),
  };
}

const trialOf = (user: EntitlementsInput | undefined): Entitlements["trial"] => ({
  endsAt: user?.billing?.trial_end ?? null,
  used: user?.billing?.trial_used === true,
});

export function getEntitlements(user: EntitlementsInput | undefined): Entitlements {
  const {planId, plan} = planOf(user);
  const label = plan?.label ?? "none";
  const paid = PAID_LABELS.has(label);
  const status = user?.billing?.status;
  const active = !!status && ACTIVE_STATUSES.has(status);

  return {
    planId,
    label,
    active,
    paid,
    trial: trialOf(user),
    limits: limitsOf(user, plan, paid),
    flags: {stories: paid, reels: paid, igVideo: paid, postProcess: paid && active, waitForProcessing: paid},
  };
}

export function reachedPostQuota(ent: Entitlements, postsThisMonth: number): boolean {
  return ent.limits.postsPerMonth !== null && postsThisMonth >= ent.limits.postsPerMonth + ent.limits.postsGrace;
}

const NOT_ON_FREE = new Set(["twitter", "youtube", "tiktok", "pinterest", "bluesky", "gmb"]);

const NOT_ON_BASIC = new Set(["youtube", "tiktok", "gmb"]);

export type PlatformAccess = {ok: true} | {ok: false; plan: "free" | "basic"};

// Which plan blocks posting to this account (publish/index.ts lists, unchanged).
export function platformAccess(ent: Entitlements, platform: string, accType?: string): PlatformAccess {
  const linkedinPage = platform === "linkedin" && accType === "page";

  if (!ent.paid && (NOT_ON_FREE.has(platform) || linkedinPage)) return {ok: false, plan: "free"};

  if (ent.label === "basic" && (NOT_ON_BASIC.has(platform) || linkedinPage)) return {ok: false, plan: "basic"};

  return {ok: true};
}

export type CappedMedia = {type: string; size: number}; // size in bytes

export type MediaOverCap = {index: number; type: "image" | "video"; size: number; capMB: number};

const MB = 1024 * 1024;

// Files bigger than the plan allows (#108). Other types (doc) have no plan cap. The env
// maxMediaSize (300 MB) still applies to every plan, so premium video is 300 MB in practice.
export function mediaOverPlanCap(ent: Entitlements, media: readonly CappedMedia[]): MediaOverCap[] {
  return media.flatMap((m, index) => {
    if (m.type !== "image" && m.type !== "video") return [];

    const capMB = m.type === "image" ? ent.limits.imageMB : ent.limits.videoMB;

    return m.size > capMB * MB ? [{index, type: m.type, size: m.size, capMB}] : [];
  });
}
