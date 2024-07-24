import {NotionClientError} from "@notionhq/client";
import {AxiosError} from "axios";
import {getNotionError} from "notion";
import {freeMonthlyPostLimit} from "pricing";
import {postPublishStages, publishStageIndex} from "publish";
import {PostPublishStage} from "types";

export const publishErrorCodes = [
  "notion-database-deleted",
  "notion-database-locked",
  "notion-database-disconnected",
  "error-getting-author",
  "inactive-subscription",
  "post-monthy-limit-reached",
  "error-getting-property-media",
  "error-processing-media",
  "notion-page-deleted",
  "post-already-completed",
  "post-postponed",
  "post-cancelled",
  "server-error",
] as const;

export type PublishErrorCode = (typeof publishErrorCodes)[number];
export interface PublishErrorOptions {
  message?: string;
  critical?: boolean;
  cause?: Error;
}
export const publishDisruptErrorMessages: {[key in PublishErrorCode]?: string} = {
  "notion-database-deleted": "🔴 Notion database deleted",
  "notion-database-locked":
    "🔒 Notion database is locked, Please upgrade your plan to continue scheduling posts.",
  "notion-database-disconnected":
    "🔴 Notion database got disconnected, Please refresh it in Notionsocial dashboard and try again.",
  "inactive-subscription": "🔒 Please upgrade your subscription or pay existing bill due.",
  "post-monthy-limit-reached": `🔒 You've reached your monthly limit of ${freeMonthlyPostLimit} posts for free accounts. Upgrade to a paid plan to post unlimited times.`,
};

type ErrorWithPossibleToJSON = Error & {
  toJSON?: () => any;
};

export class PublishError extends Error {
  readonly code: PublishErrorCode;
  readonly critical: boolean;
  readonly cause?: ErrorWithPossibleToJSON;

  constructor(code: PublishErrorCode, options?: PublishErrorOptions) {
    const name = `PublishError`;
    super(options?.message || options?.cause?.message || code || name);

    this.code = code;
    this.critical = options?.critical ?? true;
    this.cause = options?.cause;

    if (this.cause) {
      // Use the cause's stack if available
      this.stack = this.cause.stack;
    } else if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Copy properties from cause, if any
    if (options?.cause) {
      Object.assign(this, options.cause);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      critical: this.critical,
      stack: this.stack,
      cause:
        this.cause && "toJSON" in this.cause && typeof this.cause.toJSON === "function"
          ? this.cause.toJSON()
          : this.cause
          ? String(this.cause)
          : undefined,
    };
  }

  toString(): string {
    let str = `${this.name}: ${this.message} (Code: ${this.code}, Critical: ${this.critical})`;
    if (this.cause) {
      str += `\nCaused by: ${this.cause}`;
    }
    if (this.stack) {
      str += `\n${this.stack}`;
    }
    return str;
  }

  static isPublishError(error: unknown): error is PublishError {
    return error instanceof PublishError;
  }

  static create(code: PublishErrorCode, options?: PublishErrorOptions): PublishError {
    return new PublishError(code, options);
  }

  static reject(code: PublishErrorCode, options?: PublishErrorOptions): Promise<never> {
    return Promise.reject(new PublishError(code, options));
  }

  static log(error: unknown): void {
    console.log("⨂ PublishError");
    if (this.isPublishError(error)) {
      console.log(`Code: ${error.code}`);
      console.log(`Message: ${error.message}`);

      console.log(error.stack);
    } else {
      console.log(error);
    }
  }
}
export function isNetworkServerError(error: AxiosError | any) {
  const message = String(error?.message)?.toLowerCase() || String(error)?.toLowerCase();
  const statusInt = Number(error?.response?.status || error.status);
  const statusStr = String(statusInt)?.toLowerCase();
  const code = String(error?.code)?.toLowerCase();
  return (
    (statusInt && typeof statusInt == "number" && statusInt >= 500) ||
    code?.includes("econnreset") ||
    code?.includes("etimedout") ||
    code?.includes("enotfound") ||
    code?.includes("econnaborted") ||
    message?.includes("network socket disconnected") ||
    message?.includes("socket hang up") ||
    statusStr?.includes("socket hang up") ||
    message?.includes("timeout")
  );
}
type PublishFunctionError = Error | PublishError | AxiosError | NotionClientError;
export function catchPublishError(
  e: PublishFunctionError,
  stage: PostPublishStage,
  messageUpdateCallback: (message: string | null, code: PublishErrorCode) => Promise<any>
) {
  PublishError.log(e);
  const {
    isServerError,
    message,
    isNotionDatabaseDeleted,
    isNotionDatabaseDisconnected,
    isCancelled,
    isPostPoned,
    isNotionPageDeleted,
    code,
  } = decodePublishError(e, stage);

  // If a server error occurs during publishing, return error, so that it can be retried
  if (isServerError) {
    console.info("⨂ rejecting as server error disrupted publishing ⨂");
    return Promise.reject(e);
  }

  const canUpdateNsProp =
    !isNotionDatabaseDeleted && !isNotionDatabaseDisconnected && !isNotionPageDeleted;
  const toClearNsProp = isCancelled || isPostPoned;
  if (canUpdateNsProp) return messageUpdateCallback(toClearNsProp ? null : message, code);
  else return Promise.resolve(message);
}

export function decodePublishError(e: PublishFunctionError, stage: PostPublishStage) {
  if (stage) console.log(`Stage: ${stage}`);
  if (e["status"]) console.log(`Status: ${e["status"]}`);

  const code: PublishErrorCode = e?.["code"];
  const _msg = String(e?.message || e) || String(code) || "unknown error occured";
  let message = _msg.substring(0, 512);

  const notionError = getNotionError(e);

  const isNotionServerError = notionError.isServerError;
  const isNetworkServerErr = isNetworkServerError(e);
  const stageIndex = postPublishStages.indexOf(stage);
  const prePublishError = stageIndex && stageIndex >= 0 && stageIndex <= publishStageIndex;

  const isTknError = notionError?.isTknError;
  const isDltError = notionError?.isDltError;
  const isPageDltError = notionError?.pageDlt;

  const isServerError = prePublishError && (isNotionServerError || isNetworkServerErr);

  const isNotionDatabaseDeleted = isDltError || code == "notion-database-deleted";
  const isNotionDatabaseDisconnected = isTknError || code == "notion-database-disconnected";
  if (isNotionDatabaseDeleted)
    message = publishDisruptErrorMessages["notion-database-deleted"];
  if (isNotionDatabaseDisconnected)
    message = publishDisruptErrorMessages["notion-database-disconnected"];

  return {
    isServerError,
    isNotionDatabaseDeleted,
    isNotionDatabaseDisconnected,
    isPostPoned: code == "post-postponed",
    isCancelled: code == "post-cancelled",
    isAlreadyCompleted: code == "post-already-completed",
    isNotionPageDeleted: isPageDltError || code == "notion-page-deleted",
    message,
    code,
  };
}
