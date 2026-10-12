# user-ops

Account actions on a user's login, billing and affiliate record (#31). Same code behind the
self-serve /account routes (functions) and the Crisp admin modal (admin Worker).

```
api       createUserOps(ports) -> {deleteAccount, updateEmail, requestEmailChange,
          confirmEmailChange, enrollAffiliate, extendTrial, logAffiliatePayout, requestPayout,
          findLogin}: Promise<{ok, value} | {ok: false, error}>
          decode*Body: request bodies of the self-serve routes
entry     root export (functions) · "@pulbyte/notionsocial-global/user-ops" (Worker, no Node)
services  Auth · Store (Firestore) · Billing (Stripe + PayPal) · Crisp · Receipt; callers pass
          Promise ports, portsLayer wraps them
writes    affiliate/{link} (create, payments) · users/{uid} affiliate_partner, billing,
          trial_extended_at, email_change (#41) · account_deletions/{id} · deletes users,
          sm_accs, notion_dbs, posts
rules     delete stops billing before data; a Stripe failure stops it · self-serve email change
          syncs Stripe + Crisp only once the login holds the verified new email (#41) ·
          self-serve trial extension once per user, trial or paused only · Stripe customer by
          metadata, no search
errors    errors.ts (tagged); PortFailed names the failed call
```
