import {expect, test} from "vitest";
import {ERROR_CATALOGUE, type ErrorCode, explain} from "./errors";
import fixture from "./errors.fixture.json";

// The texts users saw before the catalogue (functions lib/text.ts, 2026-10-05) must not change.
test("every catalogue message equals the text users saw", () => {
  for (const [code, text] of Object.entries(fixture)) {
    // SAFETY: the fixture keys were generated from the catalogue codes.
    expect([code, explain(code as ErrorCode).message]).toEqual([code, text]);
  }

  expect(Object.keys(ERROR_CATALOGUE).sort()).toEqual(Object.keys(fixture).sort());
});

test("every entry names a cause, a fix and a fault", () => {
  for (const e of Object.values(ERROR_CATALOGUE)) {
    expect(e.cause.length).toBeGreaterThan(10);
    expect(e.fix.length).toBeGreaterThan(5);
    expect(["user", "platform", "notionsocial"]).toContain(e.fault);
  }
});
