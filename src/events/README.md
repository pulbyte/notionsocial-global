# events

What happened to a post, account or database, and who hears about it (#34).

```
api       planDelivery(event, lastSentAt, now) -> {key, send, channels} (pure)
          ROUTES: channel + dedupe window per event type · dedupeKey(event)
events    post.failed · post.stuck · post.skipped · account.unresolved · account.expired ·
          token.expiring · ndb.broken · billing.payment_failed · trial.ending · ops.quota_low
writer    functions lib/events.ts: events/{id} log + events_sent/{key} claim in a transaction
next      daily digest mode; Crisp and ops channels; nothing calls email.ts directly
```
