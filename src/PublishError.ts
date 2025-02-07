import {freeMonthlyPostLimit} from "./pricing";

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
  "task-processing",
  "post-not-processed",
  "no-social-account-selected",
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
