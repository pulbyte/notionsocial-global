# decide

One typed way to ask Cloudflare's Clef (@cf/cloudflare/clef) a question; every answer is logged (#29).

```
api       createDecide(layers).choice(question, caller) -> Decision (answer null on any error)
          choiceEffect(question, caller) for Effect callers
services  Clef (clefLive({accountId, apiToken}): Workers AI REST, model "clef")
          DecisionLog (decisions/{id}) · DecisionThresholds (per kind, from config)
rules     5 s timeout, 1 retry · null -> action "safe-path" (never publish on null) ·
          tokens and long text are refused before sending (UnsafePayload)
errors    ClefTimeout · ClefHttpError · ClefBadAnswer · UnsafePayload
pending   score() · a recorded fixture (needs CLOUDFLARE_AI_TOKEN) · admin review list
```
