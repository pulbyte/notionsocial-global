import * as crypto from "crypto";
import {isNodeEnvironment} from "./env";
import {SecureAuthToken} from "./types";

const algorithm = "aes-256-cbc";
export const encKeyVersion = process.env.ENCRPT_KEY_VERSION;

// Only check environment variables in Node.js runtime (not during browser runtime)
if (isNodeEnvironment()) {
  if (!encKeyVersion) {
    throw new Error("ENCRPT_KEY_VERSION is not set as env variable");
  }
  if (!process.env[`ENCRYPTION_KEY_V${encKeyVersion}`]) {
    throw new Error(`ENCRYPTION_KEY_V${encKeyVersion} is not set as env variable`);
  }
}

function getEncryptionKey(keyVersion: string) {
  const key = process.env[`ENCRYPTION_KEY_V${keyVersion}`];
  if (!key) {
    throw new Error(`ENCRYPTION_KEY_V${keyVersion} is not set as env variable`);
  }
  return Buffer.from(key, "hex");
}

export function encrypt(text: string, keyVersion?: string, existingIv?: string) {
  const kv = keyVersion || encKeyVersion;
  const key = getEncryptionKey(kv);
  // Use existing IV if provided, otherwise generate new one
  const iv = existingIv ? Buffer.from(existingIv, "hex") : crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return {
    encryptedText: encrypted,
    iv: iv.toString("hex"),
    keyVersion: kv,
  };
}

export function decrypt(encryptedText: string, iv: string, keyVersion?: string): string {
  // Use provided IV if available, otherwise use default
  const decryptIv = Buffer.from(iv, "hex");
  const key = getEncryptionKey(keyVersion || encKeyVersion);
  const decipher = crypto.createDecipheriv(algorithm, key, decryptIv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function decryptSecureToken(secureToken: SecureAuthToken) {
  const iv = secureToken.encryption?.iv;
  const keyVersion = secureToken.encryption?.key_version;
  return {
    token: decrypt(secureToken.token, iv, keyVersion),
    secret: secureToken.secret ? decrypt(secureToken.secret, iv, keyVersion) : undefined,
    refresh: secureToken.refresh
      ? {
          token: decrypt(secureToken.refresh.token, iv, keyVersion),
          expiresAt: secureToken.refresh.expires_at,
          refreshedAt: secureToken.refresh.refreshed_at,
        }
      : undefined,
    scopes: secureToken.scopes,
    expiresAt: secureToken.expires_at,
    issuedAt: secureToken.issued_at,
  };
}

export function encryptAuthToken(
  token: string,
  options: {
    tokenExpiresAt?: number;
    refreshExpiresAt?: number;
    scopes?: string[];
    secret?: string;
    refresh?: string;
    type: SecureAuthToken["type"];
    source?: SecureAuthToken["source"];
  }
): SecureAuthToken {
  const {tokenExpiresAt, refreshExpiresAt, scopes, secret, refresh, type, source} =
    options || {};
  const enc = encrypt(token, encKeyVersion);
  // Use the same IV and key version for all related encryptions
  const encSecret = secret ? encrypt(secret, enc.keyVersion, enc.iv).encryptedText : undefined;
  const encRefresh = refresh
    ? encrypt(refresh, enc.keyVersion, enc.iv).encryptedText
    : undefined;
  return {
    token: enc.encryptedText,
    secret: encSecret,
    refresh: encRefresh
      ? {
          token: encRefresh,
          expires_at: tokenExpiresAt || refreshExpiresAt,
          refreshed_at: Date.now(),
        }
      : undefined,
    scopes,
    expires_at: tokenExpiresAt,
    issued_at: Date.now(),
    source,
    encryption: {
      iv: enc.iv,
      key_version: enc.keyVersion,
    },
    type,
  };
}
