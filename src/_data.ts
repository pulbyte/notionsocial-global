import {decryptSecureToken} from "./crypto";
import {SocialAccountData} from "./types";

// Smart debug logging - only logs when issues are detected
if (typeof decryptSecureToken !== 'function') {
  console.error("CRITICAL[DATA]: decryptSecureToken unavailable - auth processing will fail");
  console.error("  Expected function, got:", typeof decryptSecureToken);
}

export function getSmAccAuthData(
  smAccData: Pick<SocialAccountData, "platform" | "secure_auth_token" | "auth" | "fb_auth">
) {
  // Smart debug logging - only when issues detected
  if (!smAccData) {
    console.error("CRITICAL[DATA]: getSmAccAuthData called with undefined/null smAccData");
    return { secure: null, token: undefined, secret: undefined, refreshToken: undefined };
  }

  const {platform, secure_auth_token, auth, fb_auth} = smAccData;
  const decrypted = secure_auth_token ? decryptSecureToken(secure_auth_token) : null;
  let data = {
    secure: secure_auth_token,
    token: decrypted?.token || auth?.access_token,
    secret: decrypted?.secret,
    refreshToken: decrypted?.refresh?.token || auth?.refresh_token,
  };
  if (platform == "instagram" && fb_auth) {
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
