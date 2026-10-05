import {Effect, Layer} from "effect";
import {expect, test} from "vitest";
import {type ChoiceQuestion, Clef, ClefHttpError, clefLive, createDecide, type Decision, DecisionLog, DecisionThresholds} from "./index";

// Recorded from @cf/cloudflare/clef on 2026-10-05 (REST response, unchanged).
const fixture = {"result": {"model": "clef", "answers": {"q": {"type": "choice", "choice": "acc_ig", "probabilities": {"acc_ig": 0.9487, "acc_x": 0.0142, "none": 0.0371}, "confidence": 0.8523}}, "usage": {"input_tokens": 178, "output_tokens": 0}}, "success": true, "errors": [], "messages": []};

const answer = fixture.result.answers.q;

const question: ChoiceQuestion = {
  kind: "account-match",
  instructions: "Which connected account does this Platforms value mean?",
  criteria: {acc_ig: "instagram, On The Rise, @ontherise.menswear"},
  state: {value: "IG@ontherise"},
};

type Reply = () => Effect.Effect<unknown, ClefHttpError>;

const ok: Reply = () => Effect.succeed(fixture);

const http500: Reply = () => Effect.fail(new ClefHttpError({status: 500}));

function setup(replies: Reply[]) {
  const logged: Decision[] = [];
  const sent: unknown[] = [];
  let calls = 0;

  const layers = Layer.mergeAll(
    // Each run (including a retry) takes the next reply.
    Layer.succeed(Clef, {ask: (body) => (sent.push(body), Effect.suspend(() => (replies[Math.min(calls++, replies.length - 1)] ?? ok)()))}),
    Layer.succeed(DecisionLog, {write: (d) => Effect.sync(() => void logged.push(d))}),
    Layer.succeed(DecisionThresholds, {get: () => Effect.succeed({accept: 0.85, review: 0.6})}),
  );

  return {decide: createDecide(layers, 50), logged, sent, calls: () => calls};
}


test("a typed answer is accepted above the configured threshold and logged once", async () => {
  const {decide, logged, sent} = setup([ok]);
  const d = await decide.choice(question, "test");

  expect(d).toMatchObject({kind: "account-match", caller: "test", action: "accept", answer: {choice: "acc_ig", confidence: 0.8523}});
  expect(logged).toEqual([d]);
  expect(sent[0]).toMatchObject({model: "clef", questions: {q: {type: "choice", criteria: {none: "none of these"}}}});
});

test("one 5xx is retried; two give a null answer and the safe path", async () => {
  const once = setup([http500, ok]);
  expect((await once.decide.choice(question, "t")).action).toBe("accept");
  expect(once.calls()).toBe(2);

  const twice = setup([http500, http500]);
  expect(await twice.decide.choice(question, "t")).toMatchObject({answer: null, action: "safe-path", error: "ClefHttpError"});
});

test("a timeout gives a null answer", async () => {
  const {decide} = setup([() => Effect.never]);
  expect(await decide.choice(question, "t")).toMatchObject({answer: null, action: "safe-path", error: "ClefTimeout"});
});

test("an answer of the wrong shape gives a null answer", async () => {
  const {decide} = setup([() => Effect.succeed({answers: {q: {choice: "x", confidence: 7}}})]);
  expect(await decide.choice(question, "t")).toMatchObject({answer: null, error: "ClefBadAnswer"});
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
  const review = setup([() => Effect.succeed({answers: {q: {...answer, confidence: 0.7}}})]);
  expect((await review.decide.choice(question, "t")).action).toBe("review");
  const none = setup([() => Effect.succeed({answers: {q: {choice: "none", confidence: 0.99, probabilities: {}}}})]);
  expect((await none.decide.choice(question, "t")).action).toBe("reject");
});

test("the bare model output (Workers binding) decodes like the REST wrapper", async () => {
  const {decide} = setup([() => Effect.succeed({model: "clef", answers: {q: answer}, usage: {input_tokens: 1, output_tokens: 1}})]);

  expect((await decide.choice(question, "t")).answer).toMatchObject({choice: "acc_ig"});
});

test("the live client calls Workers AI through the notionsocial AI Gateway", async () => {
  const seen: Array<{url: string; headers: Record<string, string>}> = [];

  const fakeFetch = async (url: string, init: RequestInit) => {
    // SAFETY: clefLive always passes a plain headers object.
    seen.push({url, headers: init.headers as Record<string, string>});

    return new Response(JSON.stringify(fixture));
  };

  const layers = Layer.mergeAll(
    clefLive({accountId: "acc1", apiToken: "tok"}, fakeFetch),
    Layer.succeed(DecisionLog, {write: () => Effect.void}),
    Layer.succeed(DecisionThresholds, {get: () => Effect.succeed({accept: 0.85, review: 0.6})}),
  );

  await createDecide(layers).choice(question, "t");

  expect(seen[0]).toMatchObject({url: "https://api.cloudflare.com/client/v4/accounts/acc1/ai/run/@cf/cloudflare/clef", headers: {"cf-aig-gateway-id": "notionsocial"}});
});
