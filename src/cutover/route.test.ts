import fc from "fast-check";
import {expect, test} from "vitest";
import {bucket, route} from "./index";

const ids = fc.string({minLength: 1, maxLength: 40});

test("a uid always gets the same bucket, between 0 and 99", () => {
  fc.assert(
    fc.property(ids, ids, (module, uid) => {
      const b = bucket(module, uid);

      expect(b).toBe(bucket(module, uid));
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }),
  );
});

test("raising percent never moves a user back to the old path", () => {
  fc.assert(
    fc.property(ids, ids, fc.integer({min: 0, max: 100}), fc.integer({min: 0, max: 100}), (module, uid, p1, p2) => {
      const [low, high] = p1 < p2 ? [p1, p2] : [p2, p1];

      if (route(module, uid, {mode: "percent", percent: low}) === "new") {
        expect(route(module, uid, {mode: "percent", percent: high})).toBe("new");
      }
    }),
  );
});

test("percent 0 keeps everyone on old except listed uids; 100 moves everyone", () => {
  fc.assert(
    fc.property(ids, ids, (module, uid) => {
      expect(route(module, uid, {mode: "percent", percent: 0})).toBe("old");
      expect(route(module, uid, {mode: "percent", percent: 0, uids: [uid]})).toBe("new");
      expect(route(module, uid, {mode: "percent", percent: 100})).toBe("new");
    }),
  );
});

test("off, missing and allowlist without the uid stay on old", () => {
  expect(route("m", "u1", undefined)).toBe("old");
  expect(route("m", "u1", {mode: "off", uids: ["u1"]})).toBe("old");
  expect(route("m", "u1", {mode: "allowlist", uids: ["u2"]})).toBe("old");
  expect(route("m", "u1", {mode: "allowlist", uids: ["u1"]})).toBe("new");
  expect(route("m", "u1", {mode: "shadow"})).toBe("shadow");
  expect(route("m", "u1", {mode: "on"})).toBe("new");
});

test("about 10% of users land in a 10% rollout", () => {
  const inRollout = Array.from({length: 5000}, (_, i) => route("m", `uid-${i}`, {mode: "percent", percent: 10}));
  const share = inRollout.filter((r) => r === "new").length / 5000;

  expect(share).toBeGreaterThan(0.08);
  expect(share).toBeLessThan(0.12);
});
