import {decryptSecureToken} from "./crypto";
import {SocialAccountData} from "./types";

export function getSmAccAuthData(
  smAccData: Pick<
    SocialAccountData,
    "platform" | "secure_auth_token" | "auth" | "fb_auth" | "ig_auth_type"
  >
) {
  const {platform, secure_auth_token, auth, fb_auth, ig_auth_type} = smAccData;
  const decrypted = secure_auth_token ? decryptSecureToken(secure_auth_token) : null;
  let data = {
    secure: secure_auth_token,
    token: decrypted?.token || auth?.access_token,
    secret: decrypted?.secret,
    refreshToken: decrypted?.refresh?.token || auth?.refresh_token,
  };
  // ig_oauth (Instagram Login API) accounts must use their secure token;
  // a leftover fb_auth from a previous FB-linked connection is stale for them
  if (platform == "instagram" && fb_auth && ig_auth_type != "ig_oauth") {
    data.token = fb_auth?.access_token;
  }
  if (["x", "twitter"].includes(platform)) {
    data.token = auth?.oauth_token;
    data.secret = auth?.oauth_token_secret;
  }

  // Smart debug logging - only when auth data is corrupted
  if (!data.token && !data.secret) {
    console.error(`CRITICAL[DATA]: No auth tokens found for platform ${platform}`);
    console.error("  This will cause platform upload authentication failures");
  }

  return data;
}
