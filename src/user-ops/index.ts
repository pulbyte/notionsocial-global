import {Effect, Schema} from "effect";
import {deleteAccount} from "./delete";
import {toFailure, type UserOpsError, type UserOpsFailure} from "./errors";
import {enrollAffiliate, extendTrial, findLogin, logAffiliatePayout, requestPayout, updateEmail} from "./ops";
import {DeleteBody, EnrollAffiliateBody, LimitRequestBody, PayoutRequestBody, UpdateEmailBody} from "./schema";
import type {DeleteInput, EnrollInput, ExtendTrialInput, LogPayoutInput, UpdateEmailInput} from "./schema";
import {portsLayer, type UserOpsPorts, type UserOpsServices} from "./service";

export * from "./errors";

export {DELETE_REASONS, USER_ACTIONS} from "./schema";

export type {
  Affiliate,
  AffiliateFields,
  BillingFields,
  DeleteBody,
  DeleteInput,
  DeleteOutput,
  EnrollAffiliateBody,
  EnrollInput,
  EnrollOutput,
  ExtendTrialInput,
  ExtendTrialOutput,
  LimitRequestBody,
  Login,
  LogPayoutInput,
  LogPayoutOutput,
  NewAffiliate,
  OwnedCollection,
  Payment,
  PayoutRequestBody,
  PayoutRequestOutput,
  Subscription,
  UpdateEmailBody,
  UpdateEmailInput,
  UpdateEmailOutput,
  UserAction,
  UserFields,
} from "./schema";

export type {DeletionRow, UserOpsPorts} from "./service";

// Request bodies of the self-serve routes; each throws on a body that does not match.
export const decodeDeleteBody = Schema.decodeUnknownSync(DeleteBody);

export const decodeUpdateEmailBody = Schema.decodeUnknownSync(UpdateEmailBody);

export const decodeEnrollAffiliateBody = Schema.decodeUnknownSync(EnrollAffiliateBody);

export const decodePayoutRequestBody = Schema.decodeUnknownSync(PayoutRequestBody);

export const decodeLimitRequestBody = Schema.decodeUnknownSync(LimitRequestBody);

export type OpResult<A> = {ok: true; value: A} | {ok: false; error: UserOpsFailure};

// Promise API for the admin Worker and functions: the same op code runs behind both (#31).
// A failure a caller can act on comes back as {ok: false, error}; a defect rejects.
export function createUserOps(ports: UserOpsPorts) {
  const layer = portsLayer(ports);

  const run = <A>(effect: Effect.Effect<A, UserOpsError, UserOpsServices>): Promise<OpResult<A>> =>
    Effect.runPromise(
      effect.pipe(
        Effect.map((value): OpResult<A> => ({ok: true, value})),
        Effect.catch((error) => Effect.succeed<OpResult<A>>({ok: false, error: toFailure(error)})),
        Effect.provide(layer),
      ),
    );

  return {
    findLogin: (email: string) => run(findLogin(email)),
    updateEmail: (input: UpdateEmailInput) => run(updateEmail(input)),
    deleteAccount: (input: DeleteInput) => run(deleteAccount(input)),
    enrollAffiliate: (input: EnrollInput) => run(enrollAffiliate(input)),
    extendTrial: (input: ExtendTrialInput) => run(extendTrial(input)),
    logAffiliatePayout: (input: LogPayoutInput) => run(logAffiliatePayout(input)),
    requestPayout: (uid: string, amount: number) => run(requestPayout(uid, amount)),
  };
}

export type UserOps = ReturnType<typeof createUserOps>;
