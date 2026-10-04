# entitlements

One answer to "may this user do X" (CONTEXT.md: Entitlement). Ticket: pulbyte/notionsocial-backend#30.

```
api       getEntitlements(userDoc) -> {planId, label, active, paid, trial, limits, flags}
          reachedPostQuota(ent, postsThisMonth) · platformAccess(ent, platform, accType)
input     users/{uid}: billing.{plan_id, status, trial_end, trial_used} + *_limit_incr
v1        reproduces today's rules exactly (property tests compare against the inline copies)
known     paid ignores status (past_due/unpaid premium counts as paid) · no plan = 1 acc / 1 DB ·
          frontend uses different rules (paidUser true with no plan) -> fixed in later commits
```
