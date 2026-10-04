import {freeMonthlyPostLimit, PRICING_PLANS} from "../src/pricing";
import {publishDisruptErrorMessages} from "../src/PublishError";

const freePlans = Object.values(PRICING_PLANS).filter((p) => p.label === "free");

test("every free plan allows freeMonthlyPostLimit posts", () => {
  expect(freePlans.length).toBeGreaterThan(0);
  for (const plan of freePlans) expect(plan.features.monthlyPosts).toBe(freeMonthlyPostLimit);
});

test("every free-plan post figure in copy equals freeMonthlyPostLimit", () => {
  const copy = [...freePlans.map((p) => p.desc), publishDisruptErrorMessages["post-monthy-limit-reached"]!];
  for (const text of copy) {
    const figures = [...text.matchAll(/(\d+) posts/g)].map((m) => Number(m[1]));
    expect(figures).toEqual([freeMonthlyPostLimit]);
  }
});
