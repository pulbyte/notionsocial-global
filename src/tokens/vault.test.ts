import fc from "fast-check";
import {expect, test} from "vitest";
import {aesCipher, createTokenVault, type StoredToken} from "./index";

function memoryStore() {
  const docs = new Map<string, StoredToken>();

  return {docs, get: async (id: string) => docs.get(id), set: async (id: string, doc: StoredToken) => void docs.set(id, doc)};
}

const ref = {kind: "sm_accs", id: "acc1"} as const;

test("a stored token reads back as written, with last_refreshed and expires_at", async () => {
  const store = memoryStore();
  const vault = createTokenVault(store, aesCipher);
  await vault.putToken({ref, ownerUid: "u1", platform: "x", token: {token: "t", secret: "s", refreshToken: "r", expiresAt: 99}, now: 5});

  expect(await vault.getToken(ref)).toEqual({token: "t", secret: "s", refreshToken: "r", expiresAt: 99, lastRefreshed: 5});
  expect(store.docs.get("sm_accs:acc1")).toMatchObject({owner_uid: "u1", platform: "x", expires_at: 99, last_refreshed: 5});
});

test("the stored doc holds no plain token text", async () => {
  const store = memoryStore();
  await createTokenVault(store, aesCipher).putToken({ref, ownerUid: "u1", token: {token: "plain-access", refreshToken: "plain-refresh"}, now: 1});

  expect(JSON.stringify(store.docs.get("sm_accs:acc1"))).not.toMatch(/plain-/);
});

test("a missing token reads as undefined", async () => {
  expect(await createTokenVault(memoryStore(), aesCipher).getToken({kind: "notion_dbs", id: "nope"})).toBeUndefined();
});

test("any token survives a write and read", async () => {
  const text = fc.string({minLength: 1, maxLength: 200});
  await fc.assert(
    fc.asyncProperty(text, fc.option(text, {nil: undefined}), fc.option(text, {nil: undefined}), async (token, secret, refreshToken) => {
      const vault = createTokenVault(memoryStore(), aesCipher);
      await vault.putToken({ref, ownerUid: "u", token: {token, secret, refreshToken}, now: 1});
      const got = await vault.getToken(ref);

      expect([got?.token, got?.secret, got?.refreshToken]).toEqual([token, secret, refreshToken]);
    }),
    {numRuns: 50},
  );
});
