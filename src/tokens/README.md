# tokens

One read and one write path for social-account and Notion tokens (CONTEXT.md: Account).
Ticket: pulbyte/notionsocial-backend#27.

```
api       createTokenVault(store, aesCipher) -> {getToken(ref), putToken({ref, ownerUid, token, now})}
          legacySmAccToken(doc) · legacyNotionToken(doc): the token code reads today
doc       tokens/{kind}:{id}  kind = sm_accs | notion_dbs; server-only (no Firestore rule)
fields    sealed (encryptAuthToken, key_version inside) · expires_at · last_refreshed · owner_uid
key       ENCRYPTION_KEY_V<ENCRPT_KEY_VERSION> from Secret Manager
rollout   B dual-write · C backfill · D reads via cutover 'token-vault' · F drop legacy fields
```
