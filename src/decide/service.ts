import {Context, Effect, Layer} from "effect";
import {TypeSafeHttpError} from "./errors";
import type {Decision, DecisionKind, SystemOneRequest, Thresholds} from "./schema";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";

export class TypeSafe extends Context.Service<TypeSafe, {readonly ask: (body: SystemOneRequest) => Effect.Effect<unknown, TypeSafeHttpError>}>()(
  "TypeSafe",
) {}

export class DecisionLog extends Context.Service<DecisionLog, {readonly write: (d: Decision) => Effect.Effect<void>}>()("DecisionLog") {}

export class DecisionThresholds extends Context.Service<
  DecisionThresholds,
  {readonly get: (kind: DecisionKind) => Effect.Effect<Thresholds>}
>()("DecisionThresholds") {}

// Live TypeSafe client: Bearer key from Secret Manager (TYPESAFE_API_KEY), model jev-latest.
export function typeSafeLive(apiKey: string, fetchFn: typeof fetch = fetch) {
  return Layer.succeed(TypeSafe, {
    ask: (body) =>
      Effect.tryPromise({
        try: async (signal) => {
          const res = await fetchFn(ENDPOINT, {
            method: "POST",
            headers: {Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json"},
            body: JSON.stringify(body),
            signal,
          });

          if (!res.ok) throw new TypeSafeHttpError({status: res.status});

          return res.json();
        },
        catch: (e) => (e instanceof TypeSafeHttpError ? e : new TypeSafeHttpError({status: 0})),
      }),
  });
}
