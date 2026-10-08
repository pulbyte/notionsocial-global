import {expect, test} from "vitest";
import {getPlanByLabel} from "../pricing";
import {getEntitlements, mediaOverPlanCap} from "./index";

const MB = 1024 * 1024;

const userOn = (label: "free" | "basic" | "premium") => ({billing: {plan_id: getPlanByLabel(label, "prod").monthly.id, status: "active"}});

// #108: the app's plan table.
test.each([
  ["free", 5, 50],
  ["basic", 30, 500],
  ["premium", 100, 1000],
] as const)("%s plan caps images at %i MB and video at %i MB", (label, imageMB, videoMB) => {
  expect(getEntitlements(userOn(label)).limits).toMatchObject({imageMB, videoMB});
});

test("no plan or an unknown plan gets the free caps", () => {
  expect(getEntitlements(undefined).limits).toMatchObject({imageMB: 5, videoMB: 50});
  expect(getEntitlements({billing: {plan_id: "price_unknown"}}).limits).toMatchObject({imageMB: 5, videoMB: 50});
});

test("returns only files over the plan cap, with their index and cap", () => {
  const media = [
    {type: "image", size: 5 * MB},
    {type: "image", size: 5 * MB + 1},
    {type: "video", size: 60 * MB},
    {type: "doc", size: 900 * MB},
  ];

  expect(mediaOverPlanCap(getEntitlements(undefined), media)).toEqual([
    {index: 1, type: "image", size: 5 * MB + 1, capMB: 5},
    {index: 2, type: "video", size: 60 * MB, capMB: 50},
  ]);
  expect(mediaOverPlanCap(getEntitlements(userOn("basic")), media)).toEqual([]);
});

test("premium video under 1000 MB passes the plan cap", () => {
  expect(mediaOverPlanCap(getEntitlements(userOn("premium")), [{type: "video", size: 999 * MB}])).toEqual([]);
});
