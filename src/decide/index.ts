import {createHash} from "crypto";
import {Duration, Effect, Layer, Schema} from "effect";
import {TypeSafeBadAnswer, TypeSafeTimeout, UnsafePayload} from "./errors";
import {type ChoiceAnswer, type ChoiceQuestion, type Decision, type DecisionAction, type SystemOneRequest, SystemOneResponse, type Thresholds} from "./schema";
import {DecisionLog, DecisionThresholds, TypeSafe} from "./service";

export {TypeSafeBadAnswer, TypeSafeHttpError, TypeSafeTimeout, UnsafePayload} from "./errors";

export type {ChoiceAnswer, ChoiceQuestion, Decision, DecisionAction, DecisionKind, Thresholds} from "./schema";

export {DecisionLog, DecisionThresholds, TypeSafe, typeSafeLive} from "./service";

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
    const typesafe = yield* TypeSafe;

    const body: SystemOneRequest = {
      model: "jev-latest",
      state: q.state,
      questions: {[QUESTION]: {type: "choice", instructions: q.instructions, criteria: {...q.criteria, none: "none of these"}}},
    };

    const raw = yield* typesafe.ask(body).pipe(
      Effect.timeoutOrElse({duration: Duration.millis(timeoutMs), orElse: () => Effect.fail(new TypeSafeTimeout({ms: timeoutMs}))}),
      Effect.retry({times: 1}),
    );

    const decoded = yield* Schema.decodeUnknownEffect(SystemOneResponse)(raw).pipe(Effect.mapError((e) => new TypeSafeBadAnswer({issue: String(e)})));

    return decoded.answers[QUESTION] ?? null;
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

export type DecideServices = Layer.Layer<TypeSafe | DecisionLog | DecisionThresholds>;

// Promise API for callers outside Effect code (functions, admin).
export function createDecide(services: DecideServices, timeoutMs = TIMEOUT_MS) {
  return {choice: (q: ChoiceQuestion, caller: string) => Effect.runPromise(choiceEffect(q, caller, timeoutMs).pipe(Effect.provide(services)))};
}
