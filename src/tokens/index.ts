import type {Cipher, StoredToken, Token, TokenRef, TokenStore} from "./schema";

export {aesCipher} from "./cipher";

export {legacyNotionToken, legacySmAccToken} from "./legacy";

export type {Cipher, StoredToken, Token, TokenRef, TokenStore} from "./schema";

export const tokenDocId = (ref: TokenRef) => `${ref.kind}:${ref.id}`;

export type PutToken = {
  ref: TokenRef;
  ownerUid: string;
  platform?: string;
  token: Omit<Token, "lastRefreshed">;
  now: number;
};

// One read and one write path for social and Notion tokens (#27).
export function createTokenVault(store: TokenStore, cipher: Cipher) {
  async function getToken(ref: TokenRef): Promise<Token | undefined> {
    const doc = await store.get(tokenDocId(ref));

    if (!doc) return undefined;

    return {...cipher.open(doc.sealed), expiresAt: doc.expires_at ?? undefined, lastRefreshed: doc.last_refreshed};
  }

  async function putToken(put: PutToken): Promise<void> {
    const doc: StoredToken = {
      kind: put.ref.kind,
      id: put.ref.id,
      owner_uid: put.ownerUid,
      platform: put.platform,
      sealed: cipher.seal({...put.token, lastRefreshed: put.now}),
      expires_at: put.token.expiresAt ?? null,
      last_refreshed: put.now,
      updated_at: put.now,
    };

    await store.set(tokenDocId(put.ref), doc);
  }

  return {getToken, putToken};
}

export type TokenVault = ReturnType<typeof createTokenVault>;
