import {createHash} from "node:crypto";
import {Duration, Effect, Layer, Schema} from "effect";
import {ClefBadAnswer, ClefTimeout, UnsafePayload} from "./errors";
import {type ChoiceAnswer, type ChoiceQuestion, type ClefRequest, ClefResponse, ClefRestResponse, type Decision, type DecisionAction, type DecisionKind, type Thresholds} from "./schema";
import {Clef, clefLive, DecisionLog, DecisionThresholds} from "./service";

export {ClefBadAnswer, ClefHttpError, ClefTimeout, UnsafePayload} from "./errors";

export type {ChoiceAnswer, ChoiceQuestion, Decision, DecisionAction, DecisionKind, Thresholds} from "./schema";

export {DecisionLog, DecisionThresholds, Clef, clefLive} from "./service";

const TIMEOUT_MS = 5000;

const QUESTION = "q";

// Tokens and page bodies never leave: long values and known token prefixes are refused.
const TOKEN_LIKE = /^(secret_|ntn_|EAA|ya29\.|sk_|rk_|xox|ghp_|Bearer )/;

const MAX_VALUE = 300;

function unsafeField(q: ChoiceQuestion): string | undefined {
  const fields: Array<[string, string]> = [
    ...Object.entries(q.criteria),
    ...Object.entries(q.state).map(([k, v]): [string, string] => [k, String(v)]),
  ];

  if (q.instructions.length > MAX_VALUE * 4 || TOKEN_LIKE.test(q.instructions)) return "instructions";

  return fields.find(([, v]) => v.length > MAX_VALUE || TOKEN_LIKE.test(v))?.[0];
}

const hash = (q: ChoiceQuestion) => createHash("sha256").update(JSON.stringify([q.kind, q.criteria, q.state])).digest("hex").slice(0, 16);

const actionFor = (answer: ChoiceAnswer | null, t: Thresholds): DecisionAction => {
  if (!answer || answer.choice === "none") return answer ? "reject" : "safe-path";

  if (answer.confidence >= t.accept) return "accept";

  return answer.confidence >= t.review ? "review" : "reject";
};

const ask = (q: ChoiceQuestion, timeoutMs: number) =>
  Effect.gen(function* () {
    const field = unsafeField(q);

    if (field) return yield* Effect.fail(new UnsafePayload({field}));
    const clef = yield* Clef;

    const body: ClefRequest = {
      model: "clef",
      state: q.state,
      questions: {[QUESTION]: {type: "choice", instructions: q.instructions, criteria: {...q.criteria, none: "none of these"}}},
    };

    const raw = yield* clef.ask(body).pipe(
      Effect.timeoutOrElse({duration: Duration.millis(timeoutMs), orElse: () => Effect.fail(new ClefTimeout({ms: timeoutMs}))}),
      Effect.retry({times: 1}),
    );

    // REST wraps the output in `result`; accept both so a Workers binding can be swapped in.
    const decoded = yield* Schema.decodeUnknownEffect(Schema.Union([ClefRestResponse, ClefResponse]))(raw).pipe(
      Effect.mapError((e) => new ClefBadAnswer({issue: String(e)})),
    );

    const output = "result" in decoded ? decoded.result : decoded;

    return output.answers[QUESTION] ?? null;
  });

type Outcome = {answer: ChoiceAnswer | null; error?: string};

// One question, one logged decision. Any failure gives answer null and action "safe-path";
// callers must then take their safe path (never publish on null).
export const choiceEffect = (q: ChoiceQuestion, caller: string, timeoutMs = TIMEOUT_MS) =>
  Effect.gen(function* () {
    const outcome = yield* ask(q, timeoutMs).pipe(
      Effect.map((answer): Outcome => ({answer})),
      Effect.catch((e) => Effect.succeed<Outcome>({answer: null, error: e._tag})),
    );

    const thresholds = yield* (yield* DecisionThresholds).get(q.kind);

    const decision: Decision = {
      kind: q.kind,
      caller,
      input_hash: hash(q),
      answer: outcome.answer,
      action: actionFor(outcome.answer, thresholds),
      ...(outcome.error && {error: outcome.error}),
      created_at: Date.now(),
    };

    yield* (yield* DecisionLog).write(decision);

    return decision;
  });

export type DecideServices = Layer.Layer<Clef | DecisionLog | DecisionThresholds>;

// Promise API for callers outside Effect code (functions, admin).
export function createDecide(services: DecideServices, timeoutMs = TIMEOUT_MS) {
  return {choice: (q: ChoiceQuestion, caller: string) => Effect.runPromise(choiceEffect(q, caller, timeoutMs).pipe(Effect.provide(services)))};
}

// Promise-only wiring for callers that cannot import Effect (functions' CommonJS tests):
// Clef through the AI Gateway plus a decision writer and a threshold reader they supply.
// A failed write or threshold read never turns an answer into an error.
export function createDecideLive(opts: {
  accountId: string;
  apiToken: string;
  writeDecision: (d: Decision) => Promise<void>;
  thresholds: (kind: DecisionKind) => Promise<Thresholds>;
}) {
  return createDecide(
    Layer.mergeAll(
      clefLive({accountId: opts.accountId, apiToken: opts.apiToken}),
      Layer.succeed(DecisionLog, {write: (d) => Effect.promise(() => opts.writeDecision(d).catch(() => undefined))}),
      Layer.succeed(DecisionThresholds, {
        get: (kind) => Effect.promise(() => opts.thresholds(kind).catch(() => FALLBACK_THRESHOLDS)),
      }),
    ),
  );
}

// Used when the threshold read fails: strict, so a bad config never auto-accepts.
const FALLBACK_THRESHOLDS: Thresholds = {accept: 1.01, review: 0.6};
