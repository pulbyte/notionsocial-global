# page-state

One visible state per page and a reason for every skip (CONTEXT.md: Post). Ticket: #32.

```
api       applyPageEvent(stored, event, now) -> {stored, changed} (pure; refused move = no change)
          initialPageState() · PAGE_STATES · SKIP_REASONS
states    draft > queued > scheduled > publishing > published | partial | failed | skipped(reason)
events    scan.ready · scan.queue · scan.skip · postpone · cancel · publish.start · publish.retry ·
          publish.done{ok, failed} · publish.fail{code} · retry · reset
machine   machine.ts (XState v5, no I/O); stored = state + context + version + last 20 transitions
next      writer: Firestore transaction on posts/{id} + one NotionSocial line per state (#32 B)
```
