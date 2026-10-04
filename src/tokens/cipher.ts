import {decryptSecureToken, encryptAuthToken} from "../crypto";
import type {Cipher} from "./schema";

// AES key from Secret Manager (ENCRYPTION_KEY_V<n>); key_version is stored with each token.
export const aesCipher: Cipher = {
  seal: (t) =>
    encryptAuthToken(t.token, {
      secret: t.secret,
      refresh: t.refreshToken,
      tokenExpiresAt: t.expiresAt,
      type: "oauth2",
    }),
  open: (sealed) => {
    const plain = decryptSecureToken(sealed);

    return {
      token: plain.token,
      secret: plain.secret,
      refreshToken: plain.refresh?.token,
      expiresAt: plain.expiresAt,
    };
  },
};
