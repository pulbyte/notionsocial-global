import {getSmAccAuthData} from "../_data";
import type {LegacyNotionDb, LegacySmAcc, Token} from "./schema";

// The token the code reads today from sm_accs fields (getSmAccAuthData rules, unchanged).
export function legacySmAccToken(doc: LegacySmAcc): Omit<Token, "lastRefreshed"> | undefined {
  const data = getSmAccAuthData(doc);

  if (!data.token) return undefined;
  const expiresAt = doc.secure_auth_token?.expires_at ?? doc.fb_auth?.expires ?? doc.auth?.expires;

  return {token: data.token, secret: data.secret, refreshToken: data.refreshToken, expiresAt};
}

export function legacyNotionToken(doc: LegacyNotionDb): Omit<Token, "lastRefreshed"> | undefined {
  return doc.access_token ? {token: doc.access_token} : undefined;
}
