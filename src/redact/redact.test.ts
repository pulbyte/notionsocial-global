import {AxiosError, AxiosHeaders} from "axios";
import {describe, expect, it} from "vitest";
import {logAxiosError} from "../http";
import {redactSecrets} from "./index";

const FAKE = "FAKEsecretvalue123456";

const KEYS = [
  "access_token", "refresh_token", "client_secret", "token", "secret", "password", "key",
  "api_key", "apikey", "authorization", "oauth_token", "oauth_token_secret",
  "fb_exchange_token", "code", "id_token",
];

type Holder = {token: string; body: Buffer; self?: Holder};

describe("redactSecrets: objects", () => {
  it("masks sensitive object keys, case-insensitive, at any depth", () => {
    const out = redactSecrets({
      config: {
        headers: {Authorization: `Bearer ${FAKE}`, "Content-Type": "application/json"},
        params: {access_token: FAKE, Client_Secret: FAKE, fields: "id,name"},
        auth: {username: "me", password: FAKE},
      },
      list: [{refresh_token: FAKE}],
    });

    expect(out.config.headers.Authorization).toBe("Bearer FAKE…");
    expect(out.config.headers["Content-Type"]).toBe("application/json");
    expect(out.config.params).toEqual({access_token: "FAKE…", Client_Secret: "FAKE…", fields: "id,name"});
    expect(out.config.auth).toEqual({username: "me", password: "FAKE…"});
    expect(out.list[0]?.refresh_token).toBe("FAKE…");
  });

  it("masks every listed key", () => {
    const out = redactSecrets(Object.fromEntries(KEYS.map((k) => [k.toUpperCase(), FAKE])));

    for (const k of KEYS) expect(out[k.toUpperCase()]).toBe("FAKE…");
  });

});

describe("redactSecrets: strings", () => {
  it("masks query params in URLs", () => {
    const url = `https://graph.facebook.com/v19.0/me?fields=id&access_token=${FAKE}&KEY=${FAKE}#x`;

    expect(redactSecrets(url)).toBe("https://graph.facebook.com/v19.0/me?fields=id&access_token=FAKE…&KEY=FAKE…#x");
  });

  it("masks x-www-form-urlencoded bodies", () => {
    const body = `grant_type=refresh_token&refresh_token=${FAKE}&client_id=abc&client_secret=${FAKE}`;

    expect(redactSecrets({data: body}).data).toBe(
      "grant_type=refresh_token&refresh_token=FAKE…&client_id=abc&client_secret=FAKE…"
    );
  });

  it("masks JSON strings and OAuth 1 headers", () => {
    expect(redactSecrets({data: `{"token": "${FAKE}","id":"1"}`}).data).toBe(`{"token": "FAKE…","id":"1"}`);
    expect(redactSecrets(`OAuth oauth_consumer_key="ck", oauth_token="${FAKE}"`)).toBe(
      `OAuth oauth_consumer_key="ck", oauth_token="FAKE…"`
    );
  });

  it("masks Bearer tokens inside free text", () => {
    expect(redactSecrets(`header was Bearer ${FAKE} and failed`)).toBe("header was Bearer FAKE… and failed");
  });

});

describe("redactSecrets: edge cases", () => {
  it("hides short secrets entirely", () => {
    expect(redactSecrets({token: "abc123"}).token).toBe("…");
  });

  it("keeps error codes and non-string values readable", () => {
    expect(redactSecrets({code: "ERR_BAD_REQUEST"}).code).toBe("ERR_BAD_REQUEST");
    expect(redactSecrets({code: 400}).code).toBe(400);
    expect(redactSecrets({code: "4/0AbFAKEauthcode"}).code).toBe("4/0A…");
  });

  it("does not touch keys that only contain a sensitive word", () => {
    expect(redactSecrets({monkey: FAKE, keyword: FAKE})).toEqual({monkey: FAKE, keyword: FAKE});
    expect(redactSecrets("monkey=banana&keyword=x")).toBe("monkey=banana&keyword=x");
  });

});

describe("redactSecrets: errors and cycles", () => {
  it("turns errors into plain records with config redacted", () => {
    const error = Object.assign(new Error(`failed for ?access_token=${FAKE}`), {
      config: {params: {client_secret: FAKE}, data: `refresh_token=${FAKE}`},
    });

    const out = redactSecrets(error);

    expect(out.message).toBe("failed for ?access_token=FAKE…");
    expect(out.config.params.client_secret).toBe("FAKE…");
    expect(out.config.data).toBe("refresh_token=FAKE…");
    expect(JSON.stringify(out)).not.toContain(FAKE);
  });

  it("labels binary data, handles cycles and leaves the input unchanged", () => {
    const input: Holder = {token: FAKE, body: Buffer.from("abc")};

    input.self = input;

    const out = redactSecrets(input);

    expect(out.body).toBe("<Buffer: 3 Bytes>");
    expect(out.self).toBe("<Circular>");
    expect(input.token).toBe(FAKE);
  });
});

describe("logAxiosError", () => {
  it("logs no secret from an axios error or a plain error with config", () => {
    const config = {
      url: `https://oauth2.googleapis.com/token?key=${FAKE}`,
      method: "post",
      headers: new AxiosHeaders({Authorization: `Bearer ${FAKE}`}),
      params: {access_token: FAKE},
      data: `client_secret=${FAKE}&refresh_token=${FAKE}`,
    };

    const response = {status: 400, statusText: "Bad Request", data: {error: "invalid_grant"}, headers: {}, config};
    const error = new AxiosError("Request failed", "ERR_BAD_REQUEST", config, null, response);
    const lines: string[] = [];
    const original = console.error;

    console.error = (...args: string[]) => lines.push(args.join(" "));

    try {
      logAxiosError(error, "token refresh");
      logAxiosError(Object.assign(new Error("gaxios"), {config}), "youtube");
    } finally {
      console.error = original;
    }

    expect(lines).toHaveLength(2);

    for (const line of lines) expect(line).not.toContain(FAKE);
    expect(lines[0]).toContain("invalid_grant");
  });
});
