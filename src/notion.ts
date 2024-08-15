import {Client, NotionClientError} from "@notionhq/client";
import {
  UpdateDatabaseResponse,
  GetDatabaseResponse,
  CreatePageResponse,
  UpdatePageResponse,
  GetPageResponse,
  SearchResponse,
  TextRichTextItemResponse,
  ParagraphBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {APIErrorCode, ClientErrorCode, isNotionClientError} from "@notionhq/client";
import {ignorePromiseError, retryOnCondition} from "./utils";
import {NotionColor, NotionRichTextPayload, NotionRule} from "./types";
import {hasText, notionRichTextParser} from "./text";
import {dev} from "./env";

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
export function getNotionPropertyMatchVal(property) {
  if (property.type == "checkbox") {
    return property[property.type];
  } else if (property.type == "rich_text") {
    return notionRichTextParser(property[property.type]);
  } else if (property.type == "select") {
    return String(property[property.type]?.["name"]).trim();
  } else if (property.type == "multi_select") {
    return property[property.type]?.map((select) => String(select.name)?.trim());
  } else return null;
}

export function parseNotionRule(filterStr: string, properties): boolean {
  if (!filterStr || filterStr == null) return null;
  else if (filterStr == "true") return true;
  else if (filterStr == "false") return false;
  else {
    const filter: NotionRule = JSON.parse(filterStr);
    const propertyName = filter["property"];
    const property = properties[propertyName];
    // ** When a rule property is deleted from the database
    if (!property) return false;
    const rule: "contains" | "equals" = filter.rule;
    const matchVal = getNotionPropertyMatchVal(property);
    if (
      matchVal &&
      rule == "contains" &&
      ["rich_text", "multi_select"].includes(filter.type) &&
      (typeof matchVal == "string" || typeof matchVal == "object")
    ) {
      return matchVal.includes(filter.match);
    } else if (matchVal && rule == "equals") {
      switch (typeof matchVal) {
        case "string":
          return matchVal == filter.match;
        case "boolean":
          return String(matchVal) == String(filter.match);
        case "object":
          return matchVal.length == 1 && matchVal[0] == filter.match;
        default:
          return false;
      }
    } else return false;
  }
}
export interface NotionCodedTextPayload {
  text: string;
  color?: NotionColor;
  br?: boolean;
  sp?: boolean;
  ul?: boolean;
}
function createCodedRichText(texts: NotionCodedTextPayload[]) {
  const richText: NotionRichTextPayload[] = [];

  texts.forEach(({text, color, br, sp, ul}, index) => {
    const nextText = texts[index + 1];
    const isLast = index === texts.length - 1;
    const hasNext = hasText(nextText?.text) && !isLast;

    // Regular expression to match URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    // Split the text by URLs
    const parts = text.split(urlRegex);

    parts.forEach((part, partIndex) => {
      if (urlRegex.test(part)) {
        // This part is a URL
        richText.push({
          text: {
            content: part,
            link: {url: part},
          },
          annotations: {
            bold: true,
            color: color || "default",
            code: true,
            underline: ul,
          },
        });
      } else if (part.length > 0) {
        // This part is regular text
        richText.push({
          text: {content: part},
          annotations: {
            bold: true,
            color: color || "default",
            code: true,
            underline: ul,
          },
        });
      }
    });

    if (sp && hasNext) richText.push({text: {content: " "}});
    if (br && hasNext) richText.push({text: {content: "\n"}});
  });

  return {
    type: "rich_text",
    rich_text: richText,
  };
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
