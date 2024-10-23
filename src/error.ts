import {NotionClientError} from "@notionhq/client";
import {AxiosError} from "axios";
import {getNotionError} from "./notion";
import {publishDisruptErrorMessages, PublishError, PublishErrorCode} from "./PublishError";
import {PostPublishStage} from "./types";
import {postPublishStages, publishStageIndex} from "publish";

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
  notionMessageUpdateCallback: (
    message: string | null,
    code: PublishErrorCode
  ) => Promise<any>,
  postRecordUpdateCallback: (updates: object) => Promise<any>
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

  const isTaskProcessing = code == "task-processing";

  const updateProcessingPromise = isTaskProcessing
    ? Promise.resolve()
    : postRecordUpdateCallback({processing: false});

  return updateProcessingPromise?.finally(() => {
    // If a server error occurs during publishing, return error, so that it can be retried
    if (isServerError) {
      console.info("⨂ rejecting as server error disrupted publishing ⨂");
      return Promise.reject(e);
    } else if (isTaskProcessing) {
      console.info("⨂ rejecting as the task processing is in progress ⨂");
      return Promise.reject(e);
    }

    const canUpdateNsProp =
      !isNotionDatabaseDeleted && !isNotionDatabaseDisconnected && !isNotionPageDeleted;
    const toClearNsProp = isCancelled || isPostPoned;

    if (canUpdateNsProp) {
      return notionMessageUpdateCallback(toClearNsProp ? null : message, code);
    } else {
      return Promise.resolve(message);
    }
  });
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
