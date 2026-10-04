import type {SecureAuthToken, SocialAccountData} from "../types";

// Which doc a token belongs to: a social account (sm_accs) or a connected Notion database.
export type TokenRef = {kind: "sm_accs" | "notion_dbs"; id: string};

// A token as callers use it: plain text, in memory only.
export type Token = {
  token: string;
  secret?: string;
  refreshToken?: string;
  expiresAt?: number;
  lastRefreshed: number;
};

// tokens/{kind}:{id}. Server-only: Firestore rules have no match for this collection.
export type StoredToken = {
  kind: TokenRef["kind"];
  id: string;
  owner_uid: string;
  platform?: string;
  sealed: SecureAuthToken;
  expires_at: number | null;
  last_refreshed: number;
  updated_at: number;
};

export type TokenStore = {
  get: (docId: string) => Promise<StoredToken | undefined>;
  set: (docId: string, doc: StoredToken) => Promise<void>;
};

export type Cipher = {
  seal: (token: Token) => SecureAuthToken;
  open: (sealed: SecureAuthToken) => Omit<Token, "lastRefreshed">;
};

export type LegacySmAcc = Pick<
  SocialAccountData,
  "platform" | "secure_auth_token" | "auth" | "fb_auth" | "ig_auth_type"
>;

export type LegacyNotionDb = {access_token?: string};
