import fc from "fast-check";
import {expect, test} from "vitest";
import {freeMonthlyPostLimit, isPlanPaid, isSubscriptionActive, PRICING_PLANS} from "../pricing";
import {getEntitlements, platformAccess, reachedPostQuota} from "./index";

const planIds = [...Object.keys(PRICING_PLANS), "price_unknown", undefined];

const statuses = ["trialing", "active", "past_due", "canceled", "unpaid", "incomplete", "paused", undefined];

const user = fc.record({
  billing: fc.record({plan_id: fc.constantFrom(...planIds), status: fc.constantFrom(...statuses)}),
  sm_acc_limit_incr: fc.option(fc.nat(20), {nil: undefined}),
  notion_db_limit_incr: fc.option(fc.nat(20), {nil: undefined}),
});

// The rules each gate uses today, copied from protect.ts, global/publish.ts and publish/index.ts.
const legacy = {
  smAccLimit: (u: any) => (PRICING_PLANS[u.billing.plan_id]?.sm_acc_limit || 1) + (u.sm_acc_limit_incr || 0),
  notionDbLimit: (u: any) => (PRICING_PLANS[u.billing.plan_id]?.notion_db_limit || 1) + (u.notion_db_limit_incr || 0),
  quota: (u: any, n: number) => !isPlanPaid(u.billing.plan_id) && n >= freeMonthlyPostLimit + 2,
  blocked: (u: any, platform: string, accType?: string) => {
    const paid = isPlanPaid(u.billing.plan_id);
    const page = platform == "linkedin" && accType == "page";

    if ((["twitter", "youtube", "tiktok", "pinterest", "bluesky", "gmb"].includes(platform) || page) && !paid) return "free";

    if (PRICING_PLANS[u.billing.plan_id]?.label == "basic" && (["youtube", "tiktok", "gmb"].includes(platform) || page)) return "basic";

    return undefined;
  },
};

test("limits, paid and active match today's gates for every plan, status and add-on", () => {
  fc.assert(
    fc.property(user, fc.nat(40), (u, posts) => {
      const ent = getEntitlements(u);

      expect(ent.limits.smAccs).toBe(legacy.smAccLimit(u));
      expect(ent.limits.notionDbs).toBe(legacy.notionDbLimit(u));
      expect(ent.paid).toBe(isPlanPaid(u.billing.plan_id ?? ""));
      // SAFETY: statuses above are Stripe statuses or undefined, the values isSubscriptionActive takes.
      expect(ent.active).toBe(isSubscriptionActive(u.billing.status as Parameters<typeof isSubscriptionActive>[0]));
      expect(reachedPostQuota(ent, posts)).toBe(legacy.quota(u, posts));
    }),
  );
});

test("platform access matches the publish lists for every platform and plan", () => {
  const platforms = ["x", "twitter", "facebook", "instagram", "linkedin", "youtube", "tiktok", "pinterest", "threads", "bluesky", "gmb"];
  fc.assert(
    fc.property(user, fc.constantFrom(...platforms), fc.constantFrom("page", "profile", undefined), (u, p, accType) => {
      const access = platformAccess(getEntitlements(u), p, accType);

      expect(access.ok ? undefined : access.plan).toBe(legacy.blocked(u, p, accType));
    }),
  );
});

test("no user doc reads as an unpaid user with free limits", () => {
  expect(getEntitlements(undefined)).toMatchObject({label: "none", paid: false, active: false, limits: {smAccs: 1, notionDbs: 1}});
});
