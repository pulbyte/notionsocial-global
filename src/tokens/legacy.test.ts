import {expect, test} from "vitest";
import {aesCipher, legacyNotionToken, legacySmAccToken} from "./index";

test("plain auth fields read as today", () => {
  const doc = {platform: "linkedin", auth: {access_token: "a", refresh_token: "r", expires: 7}} as const;

  expect(legacySmAccToken(doc)).toEqual({token: "a", secret: undefined, refreshToken: "r", expiresAt: 7});
});

test("X reads oauth_token and its secret", () => {
  const doc = {platform: "x", auth: {oauth_token: "o", oauth_token_secret: "os"}} as const;

  expect(legacySmAccToken(doc)).toMatchObject({token: "o", secret: "os"});
});

test("an encrypted secure_auth_token is decrypted", () => {
  const sealed = aesCipher.seal({token: "gmb", refreshToken: "gr", lastRefreshed: 1});

  expect(legacySmAccToken({platform: "gmb", secure_auth_token: sealed})).toMatchObject({token: "gmb", refreshToken: "gr"});
});

test("an account with no token reads as undefined", () => {
  expect(legacySmAccToken({platform: "tiktok"})).toBeUndefined();
});

test("a Notion database reads access_token", () => {
  expect(legacyNotionToken({access_token: "ntn"})).toEqual({token: "ntn"});
  expect(legacyNotionToken({})).toBeUndefined();
});
