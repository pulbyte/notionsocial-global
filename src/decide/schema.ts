import {Schema} from "effect";

// Who asks and why. Thresholds are configured per kind, never in callers.
export const DecisionKind = Schema.Literals(["account-match", "crisp-intake", "error-map", "property-suggest"]);

export type DecisionKind = typeof DecisionKind.Type;

// One choice question. criteria: option key -> short label; "none" is added for the caller.
export type ChoiceQuestion = {
  kind: DecisionKind;
  instructions: string;
  criteria: Record<string, string>;
  state: Record<string, string | number | boolean>; // ids and short labels only
};

// The request body System One takes; built only from a ChoiceQuestion.
export type SystemOneRequest = {
  model: "jev-latest";
  state: ChoiceQuestion["state"];
  questions: Record<string, {type: "choice"; instructions: string; criteria: Record<string, string>}>;
};

// TypeSafe System One answer for one question.
export const ChoiceAnswer = Schema.Struct({
  choice: Schema.String,
  confidence: Schema.Finite.check(Schema.isBetween({minimum: 0, maximum: 1})),
  probabilities: Schema.Record(Schema.String, Schema.Finite),
});

export type ChoiceAnswer = typeof ChoiceAnswer.Type;

export const SystemOneResponse = Schema.Struct({answers: Schema.Record(Schema.String, ChoiceAnswer)});

export type Thresholds = {accept: number; review: number};

// accept >= thresholds.accept; review between; reject below; safe-path when there is no answer.
export type DecisionAction = "accept" | "review" | "reject" | "safe-path";

// decisions/{id}: one doc per call.
export type Decision = {
  kind: DecisionKind;
  caller: string;
  input_hash: string;
  answer: ChoiceAnswer | null;
  action: DecisionAction;
  error?: string;
  created_at: number;
};
