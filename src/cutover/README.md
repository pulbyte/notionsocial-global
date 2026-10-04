# cutover

Sends each request to the old or the new code path, per Firestore `config/cutover`.
Ladder and modes: backend/docs/engineering/SAFE-CHANGES.md. Ticket: pulbyte/notionsocial-backend#26.

```
api       createCutover({read, report, now}) -> cutover({module, uid, pageId?, old, next})
modes     off: old · shadow: both run, old returned, diffs reported · allowlist: uids get new
          percent: uids + a stable hash bucket get new · on: new
safety    new throws -> old result, cutover.fallback · bad or missing config -> all off
reads     config/cutover, at most once per 60 s
emits     cutover.diff · cutover.fallback · cutover.config_invalid (via report)
rule      in shadow mode `next` must have no side effects: it runs on live traffic
```
