import {Effect, Layer} from "effect";
import {expect, test} from "vitest";
import {type ChoiceQuestion, createDecide, type Decision, DecisionLog, DecisionThresholds, TypeSafe, TypeSafeHttpError} from "./index";

// Shape from the TypeSafe System One docs (ARCHITECTURE.md); replace with a recorded answer once a key exists.
const fixture = {answers: {q: {choice: "acc_ig", confidence: 0.94, probabilities: {acc_ig: 0.94, none: 0.06}}}};

const question: ChoiceQuestion = {
  kind: "account-match",
  instructions: "Which connected account does this Platforms value mean?",
  criteria: {acc_ig: "instagram, On The Rise, @ontherise.menswear"},
  state: {value: "IG@ontherise"},
};

type Reply = () => Effect.Effect<unknown, TypeSafeHttpError>;

const ok: Reply = () => Effect.succeed(fixture);

const http500: Reply = () => Effect.fail(new TypeSafeHttpError({status: 500}));

function setup(replies: Reply[]) {
  const logged: Decision[] = [];
  const sent: unknown[] = [];
  let calls = 0;

  const layers = Layer.mergeAll(
    // Each run (including a retry) takes the next reply.
    Layer.succeed(TypeSafe, {ask: (body) => (sent.push(body), Effect.suspend(() => (replies[Math.min(calls++, replies.length - 1)] ?? ok)()))}),
    Layer.succeed(DecisionLog, {write: (d) => Effect.sync(() => void logged.push(d))}),
    Layer.succeed(DecisionThresholds, {get: () => Effect.succeed({accept: 0.9, review: 0.6})}),
  );

  return {decide: createDecide(layers, 50), logged, sent, calls: () => calls};
}


test("a typed answer is accepted above the configured threshold and logged once", async () => {
  const {decide, logged, sent} = setup([ok]);
  const d = await decide.choice(question, "test");

  expect(d).toMatchObject({kind: "account-match", caller: "test", action: "accept", answer: {choice: "acc_ig", confidence: 0.94}});
  expect(logged).toEqual([d]);
  expect(sent[0]).toMatchObject({model: "jev-latest", questions: {q: {type: "choice", criteria: {none: "none of these"}}}});
});

test("one 5xx is retried; two give a null answer and the safe path", async () => {
  const once = setup([http500, ok]);
  expect((await once.decide.choice(question, "t")).action).toBe("accept");
  expect(once.calls()).toBe(2);

  const twice = setup([http500, http500]);
  expect(await twice.decide.choice(question, "t")).toMatchObject({answer: null, action: "safe-path", error: "TypeSafeHttpError"});
});

test("a timeout gives a null answer", async () => {
  const {decide} = setup([() => Effect.never]);
  expect(await decide.choice(question, "t")).toMatchObject({answer: null, action: "safe-path", error: "TypeSafeTimeout"});
});

test("an answer of the wrong shape gives a null answer", async () => {
  const {decide} = setup([() => Effect.succeed({answers: {q: {choice: "x", confidence: 7}}})]);
  expect(await decide.choice(question, "t")).toMatchObject({answer: null, error: "TypeSafeBadAnswer"});
});

test("a question carrying a token or a page body is never sent", async () => {
  const unsafe: Array<Record<string, string>> = [{token: "secret_abc123"}, {body: "x".repeat(2000)}];

  for (const state of unsafe) {
    const {decide, calls, logged} = setup([ok]);
    expect(await decide.choice({...question, state}, "t")).toMatchObject({answer: null, error: "UnsafePayload"});
    expect(calls()).toBe(0);
    expect(logged).toHaveLength(1);
  }
});

test("confidence between review and accept is review; 'none' is reject", async () => {
  const review = setup([() => Effect.succeed({answers: {q: {...fixture.answers.q, confidence: 0.7}}})]);
  expect((await review.decide.choice(question, "t")).action).toBe("review");
  const none = setup([() => Effect.succeed({answers: {q: {choice: "none", confidence: 0.99, probabilities: {}}}})]);
  expect((await none.decide.choice(question, "t")).action).toBe("reject");
});
