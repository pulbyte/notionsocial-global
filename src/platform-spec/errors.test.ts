import {expect, test} from "vitest";
import {codeForMessage, ERROR_CATALOGUE, type ErrorCode, explain} from "./errors";
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

test("codeForMessage finds the entry inside prefixed texts and ignores raw platform text", () => {
  const video = explain("ig-video-specs").message;

  expect(codeForMessage(`Video specs error: ${video}`)).toBe("ig-video-specs");
  expect(codeForMessage(explain("x-too-long").message)).toBe("x-too-long");
  expect(codeForMessage("(#100) Invalid parameter")).toBeUndefined();
  expect(codeForMessage(undefined)).toBeUndefined();
});

test("#108 gaps: texts seen in production now map to an entry", () => {
  expect(codeForMessage("Invalid media dimensions. Videos must be between 360px and 4096px for both height and width.\n\nAlways set a time")).toBe("tt-video-dimensions");
  expect(codeForMessage("The user has exceeded the number of videos they may upload.")).toBe("yt-upload-limit");
  expect(codeForMessage("You cannot access the app till you log in to www.facebook.com and follow the instructions given.")).toBe("fb-login-checkpoint");
});

test("#108 gaps: every text functions errors.ts produces maps to its own entry", () => {
  expect(codeForMessage("Cannot tag one or more users - their accounts are private or usernames are invalid. Please remove these tags and try again.")).toBe("ig-invalid-user-tags");
  expect(codeForMessage("Your account is temporarily locked. Please log in to https://x.com to unlock your account.")).toBe("x-account-locked");
  expect(codeForMessage("Can't access video file. Video must be under 4GB.")).toBe("tt-video-pull");
  expect(codeForMessage("Content flagged. Review TikTok's community guidelines.")).toBe("tt-spam");
  expect(codeForMessage("Post description flagged. Please modify and retry.")).toBe("tt-spam-text");
  expect(codeForMessage("Google My Business API rate limit exceeded. Please try again later.")).toBe("gmb-rate-limit");
  expect(codeForMessage("YouTube quota exceeded, Wait for at least 24 hours before trying again.")).toBe("yt-quota");
});

test("#53: the upload bound text (after a file name) and the LinkedIn re-check text map to their entries", () => {
  expect(codeForMessage(`photo.jpg: ${explain("upload-timeout").message}`)).toBe("upload-timeout");
  expect(codeForMessage("LinkedIn is taking longer than expected to process your media. Please try again later.")).toBe("li-processing");
});

test("every catalogue message maps back to its own code", () => {
  // SAFETY: Object.keys of ERROR_CATALOGUE are exactly its ErrorCode keys.
  for (const code of Object.keys(ERROR_CATALOGUE) as ErrorCode[]) expect([code, codeForMessage(explain(code).message)]).toEqual([code, code]);
});

test("#56: every entry links a help page: its guide, else its row on /help/errors", () => {
  expect(explain("account-expired", "https://w.app").link).toBe("https://w.app/help/account-disconnects");
  expect(explain("fb-page-permission", "https://w.app").link).toBe("https://w.app/help/grant-access");
  expect(explain("canva-link", "https://w.app").link).toBe("https://w.app/help/errors#canva-link");

  // SAFETY: Object.keys of ERROR_CATALOGUE are exactly its ErrorCode keys.
  for (const code of Object.keys(ERROR_CATALOGUE) as ErrorCode[]) expect(explain(code, "https://w.app").link).toMatch(/^https:\/\/w\.app\/help\/[a-z-]+(#[a-z0-9-]+)?$/);
});

test("#56: ref is the entry's outside reference, else the message's URL, else absent", () => {
  expect(explain("drive-restricted").ref).toBe("https://support.google.com/drive/answer/2494822");
  expect(explain("canva-link", "https://w.app").ref).toBe("https://w.app/media-specs");
  expect(explain("ig-reel-plan", "https://w.app").ref).toBe("https://w.app/pricing");
  expect(explain("ig-not-business").ref).toBe("https://help.instagram.com/502981923235522");
  expect(explain("meta-restricted-activity").ref).toBeUndefined();
});

test("#51: Drive, Canva, external media, Meta's restriction and unsupported types have entries", () => {
  for (const code of ["drive-restricted", "canva-link", "external-media", "meta-restricted-activity", "media-type-unsupported"] as const) {
    expect(ERROR_CATALOGUE[code].platform).toBe("*");
  }
});
