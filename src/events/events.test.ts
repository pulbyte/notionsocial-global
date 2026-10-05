import fc from "fast-check";
import {expect, test} from "vitest";
import {type AppEvent, EVENT_TYPES, planDelivery, ROUTES} from "./index";

const expired: AppEvent = {type: "account.expired", uid: "u1", subject: "acc1", data: {platform: "facebook"}};

test("the first event for a subject is sent; a repeat inside the window is not; after it, it is", () => {
  const week = ROUTES["account.expired"].dedupeMs;

  expect(planDelivery(expired, undefined, 0).send).toBe(true);
  expect(planDelivery(expired, 0, week - 1).send).toBe(false);
  expect(planDelivery(expired, 0, week).send).toBe(true);
});

test("the dedupe key separates users and subjects", () => {
  const a = planDelivery(expired, undefined, 0).key;

  expect(planDelivery({...expired, subject: "acc2"}, undefined, 0).key).not.toBe(a);
  expect(planDelivery({...expired, uid: "u2"}, undefined, 0).key).not.toBe(a);
});

test("any sequence of repeats sends at most once per window", () => {
  fc.assert(
    fc.property(fc.constantFrom(...EVENT_TYPES), fc.array(fc.nat(5_000_000), {minLength: 1, maxLength: 40}), (type, gaps) => {
      const e = {...expired, type};
      let now = 0;
      let last: number | undefined;
      const sent: number[] = [];

      for (const gap of gaps) {
        now += gap;

        if (planDelivery(e, last, now).send) {
          sent.push(now);
          last = now;
        }
      }

      sent.slice(1).forEach((t, i) => expect(t - (sent[i] ?? 0)).toBeGreaterThanOrEqual(ROUTES[type].dedupeMs));
    }),
  );
});
