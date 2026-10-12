import {Effect} from "effect";
import {EmailTaken} from "./errors";
import {syncAfterLogin} from "./ops";
import type {ConfirmEmailOutput, EmailChange, Login, RequestEmailChangeInput} from "./schema";
import {Auth, Store} from "./service";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// #41: self-serve email change in two steps. This records the change; the app then asks Firebase
// to send a verify link to the new address (verifyBeforeUpdateEmail), so the login only changes
// once the user proves they own it.
export const requestEmailChange = (input: RequestEmailChangeInput) =>
  Effect.gen(function* () {
    const owner = yield* (yield* Auth).findByEmail(input.newEmail);

    if (owner && owner.uid !== input.login.uid) return yield* Effect.fail(new EmailTaken({email: input.newEmail}));
    const change: EmailChange = {from: input.login.email, to: input.newEmail, at: Date.now()};

    yield* (yield* Store).patchUser(input.login.uid, {email_change: change});

    return change;
  });

// After the link was opened, the login holds the new email: Stripe and Crisp follow it and the
// pending record is cleared. Called again, or before the link was opened, it changes nothing.
export const confirmEmailChange = (login: Login) =>
  Effect.gen(function* () {
    const store = yield* Store;
    const change = (yield* store.getUser(login.uid))?.email_change;

    if (!change) return {state: "none", uid: login.uid} satisfies ConfirmEmailOutput;

    if (!same(login.email, change.to)) return {state: "waiting", uid: login.uid} satisfies ConfirmEmailOutput;
    const warnings: string[] = [];
    const synced = yield* syncAfterLogin(login.uid, {oldEmail: change.from, newEmail: change.to}, warnings);

    yield* store.patchUser(login.uid, {email_change: null});
    const out: ConfirmEmailOutput = {state: "synced", uid: login.uid, change, warnings, ...synced};

    return out;
  });
