import {Client, NotionClientError} from "@notionhq/client";
import {
  UpdateDatabaseResponse,
  GetDatabaseResponse,
  CreatePageResponse,
  UpdatePageResponse,
  GetPageResponse,
  SearchResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {APIErrorCode, ClientErrorCode, isNotionClientError} from "@notionhq/client";
import {ignorePromiseError, retryOnCondition} from "./utils";
import {dev} from "./env";
import {createCodedRichText} from "_notion";
import {NotionCodedTextPayload} from "types";

function retry<T>(func) {
  return retryOnCondition<T>(func, isNotionServerError, notionServerErrorMessage);
}
export function NotionAPI(accessToken) {
  const notion = new Client({
    auth: accessToken,
    timeoutMs: 30000,
  });
  return {
    getDatabase: (id: string) =>
      retry<GetDatabaseResponse>(() => notion.databases.retrieve({database_id: id})),
    updateDatabase: (id: string, properties) =>
      retry<UpdateDatabaseResponse>(() =>
        notion.databases.update({database_id: id, properties})
      ),
    getPage: (id: string) =>
      retry<GetPageResponse>(() => notion.pages.retrieve({page_id: id})),
    createPage: (payload) => retry<CreatePageResponse>(() => notion.pages.create(payload)),
    updatePage: (id, properties) =>
      retry<UpdatePageResponse>(() =>
        notion.pages.update({page_id: id, properties, archived: false})
      ),
    search: (query, nextCursor = "", limit?: number) =>
      retry<SearchResponse>(() =>
        notion.search({
          query,
          filter: {
            value: "database",
            property: "object",
          },
          sort: {
            direction: "descending",
            timestamp: "last_edited_time",
          },
          page_size: nextCursor ? 100 : limit || 25,
          ...(nextCursor && {start_cursor: nextCursor}),
        })
      ),
    query: (dbId, query, limit?: number) =>
      retry<SearchResponse>(() =>
        notion.databases.query({
          database_id: dbId,
          page_size: limit || 100,
          ...query,
        })
      ),
  };
}

export function getNotionError(err: NotionClientError | any) {
  const isNtnError = isNotionClientError(err);
  const code = err?.code;
  let message = err?.message;
  message = String(message);
  const archived = message?.includes("archive");
  const isPageError =
    message?.includes("Could not find page") || message?.includes("Could not find block");

  if (isNtnError) {
    return {
      isTknError: code == APIErrorCode.Unauthorized,
      isVldError: !isPageError && code == APIErrorCode.ValidationError,
      isDltError:
        (!isPageError || message?.includes("Could not find database")) &&
        code == APIErrorCode.ObjectNotFound,
      code,
      message: message,
      isPageError,
      pageDlt:
        isPageError &&
        (code == APIErrorCode.ValidationError || code == APIErrorCode.ObjectNotFound),
      archived,
      isServerError: isNotionServerError(code),
    };
  } else return {};
}
export const notionServerErrorMessage = `Notion's server are down, Please try again later.`;

export function isNotionServerError(errorCode: NotionClientError["code"]) {
  const isServerErr = [
    APIErrorCode.ServiceUnavailable,
    APIErrorCode.InternalServerError,
    APIErrorCode.ConflictError,
    ClientErrorCode.RequestTimeout,
    ClientErrorCode.ResponseError,
  ].includes(errorCode);
  return isServerErr;
}
export async function updateNotionRichText(
  id,
  tkn,
  property,
  texts: NotionCodedTextPayload[]
) {
  return ignorePromiseError(
    new Promise((res, rej) => {
      if (id && tkn && property) {
        const props = {};
        (props[property] = texts?.length
          ? createCodedRichText(texts)
          : {
              type: "rich_text",
              rich_text: [
                {
                  text: {content: ""},
                },
              ],
            }),
          NotionAPI(tkn)
            .updatePage(id, props)
            .then((resp) => {
              res(resp.id);
            })
            .catch(rej);
      } else rej(`False -> id && tkn && property && status`);
    })
  );
}

export async function updateStatusProperty(
  id: string,
  tkn: string,
  property: string,
  status: string
) {
  if (dev) {
    console.log("updateStatusProperty", property, status);
  }
  return ignorePromiseError(
    new Promise((res, rej) => {
      if (id && tkn && property && status) {
        const props = {};
        (props[property] = {
          select: {
            name: status,
          },
        }),
          NotionAPI(tkn)
            .updatePage(id, props)
            .then((resp) => {
              res(resp.id);
            })
            .catch(rej);
      } else rej(`False -> id && tkn && property && status`);
    })
  );
}
