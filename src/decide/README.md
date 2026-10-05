# decide

One typed way to ask TypeSafe System One a question; every answer is logged (#29).

```
api       createDecide(layers).choice(question, caller) -> Decision (answer null on any error)
          choiceEffect(question, caller) for Effect callers
services  TypeSafe (typeSafeLive(key): POST api.typesafe.ai/v1/systemone, jev-latest)
          DecisionLog (decisions/{id}) · DecisionThresholds (per kind, from config)
rules     5 s timeout, 1 retry · null -> action "safe-path" (never publish on null) ·
          tokens and long text are refused before sending (UnsafePayload)
errors    TypeSafeTimeout · TypeSafeHttpError · TypeSafeBadAnswer · UnsafePayload
pending   score() · a recorded fixture (needs TYPESAFE_API_KEY) · admin review list
```
