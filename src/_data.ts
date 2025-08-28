import {decryptSecureToken} from "./crypto";
import {SocialAccountData} from "types";

export function getSmAccAuthData(
  smAccData: Pick<SocialAccountData, "platform" | "secure_auth_token" | "auth" | "fb_auth">
) {
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
  return data;
}
