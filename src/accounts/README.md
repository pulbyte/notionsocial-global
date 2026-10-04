# accounts

Finds the connected account each Platforms value on a Page means (CONTEXT.md: Resolution).
Ticket: pulbyte/notionsocial-backend#17 (exact tier). #37 adds fuzzy and AI tiers.

```
api       resolveAccounts(values, liveAccounts, writtenTags?) -> {resolved, unmatched}
          unmatchedMessage(miss) -> 'No connected account matches "IG@x". Connected: …'
rules     platform_uid · written tag (notion_dbs.sm_accs, survives renames) · account tag ·
          alias prefix (IG=IN=INSTAGRAM, X=TW, TT, TH, LI<->LI-PAGE when unique) · bare handle
input     live sm_accs of the author (duplicates collapse to the latest doc)
never     drops a value: each is resolved or unmatched with a reason
replay    2026-10-04, 2,367 cached tags: 99.1% same account as the legacy lookup;
          the rest are dead uids (legacy) or duplicate tags (ambiguous, named)
```
