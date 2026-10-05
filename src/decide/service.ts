import {Context, Effect, Layer} from "effect";
import {ClefHttpError} from "./errors";
import type {Decision, DecisionKind, ClefRequest, Thresholds} from "./schema";

export class Clef extends Context.Service<Clef, {readonly ask: (body: ClefRequest) => Effect.Effect<unknown, ClefHttpError>}>()(
  "Clef",
) {}

export class DecisionLog extends Context.Service<DecisionLog, {readonly write: (d: Decision) => Effect.Effect<void>}>()("DecisionLog") {}

export class DecisionThresholds extends Context.Service<
  DecisionThresholds,
  {readonly get: (kind: DecisionKind) => Effect.Effect<Thresholds>}
>()("DecisionThresholds") {}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

// Live Clef client: Workers AI REST API through the "notionsocial" AI Gateway (logs, limits),
// Cloudflare API token from Secret Manager (CLOUDFLARE_AI_TOKEN).
export function clefLive(auth: {accountId: string; apiToken: string; gatewayId?: string}, fetchFn: Fetch = fetch) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${auth.accountId}/ai/run/@cf/cloudflare/clef`;

  return Layer.succeed(Clef, {
    ask: (body) =>
      Effect.tryPromise({
        try: async (signal) => {
          const res = await fetchFn(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${auth.apiToken}`,
              "Content-Type": "application/json",
              "cf-aig-gateway-id": auth.gatewayId ?? "notionsocial",
            },
            body: JSON.stringify(body),
            signal,
          });

          if (!res.ok) throw new ClefHttpError({status: res.status});

          return res.json();
        },
        catch: (e) => (e instanceof ClefHttpError ? e : new ClefHttpError({status: 0})),
      }),
  });
}
