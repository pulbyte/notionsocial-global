// crypto.ts validates these at module load, so they must be set before require()
process.env.ENCRPT_KEY_VERSION = "1";
process.env.ENCRYPTION_KEY_V1 = "a1".repeat(32);

const {getSmAccAuthData} = require("../src/_data");
const {encrypt} = require("../src/crypto");

function makeSecureAuthToken(token: string) {
  const {encryptedText, iv, keyVersion} = encrypt(token);
  return {
    token: encryptedText,
    type: "oauth2",
    issued_at: Date.now(),
    expires_at: Date.now() + 60 * 24 * 60 * 60 * 1000,
    encryption: {iv, key_version: keyVersion},
  };
}

describe("getSmAccAuthData — instagram token selection", () => {
  test("ig_oauth account keeps its secure token when a stale fb_auth is present", () => {
    const data = getSmAccAuthData({
      platform: "instagram",
      ig_auth_type: "ig_oauth",
      secure_auth_token: makeSecureAuthToken("VALID_IG_OAUTH_TOKEN"),
      fb_auth: {access_token: "STALE_FB_TOKEN", expires: NaN},
    });
    expect(data.token).toBe("VALID_IG_OAUTH_TOKEN");
  });

  test("fb_sdk account still uses fb_auth.access_token", () => {
    const data = getSmAccAuthData({
      platform: "instagram",
      ig_auth_type: "fb_sdk",
      auth: {access_token: "USER_LEVEL_TOKEN"},
      fb_auth: {access_token: "FB_PAGE_TOKEN"},
    });
    expect(data.token).toBe("FB_PAGE_TOKEN");
  });

  test("legacy instagram account without ig_auth_type still uses fb_auth.access_token", () => {
    const data = getSmAccAuthData({
      platform: "instagram",
      auth: {access_token: "USER_LEVEL_TOKEN"},
      fb_auth: {access_token: "FB_PAGE_TOKEN"},
    });
    expect(data.token).toBe("FB_PAGE_TOKEN");
  });
});
