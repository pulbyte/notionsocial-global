import {Client, NotionClientError} from "@notionhq/client";
import {
  UpdateDatabaseResponse,
  CreatePageResponse,
  UpdatePageResponse,
  GetPageResponse,
  SearchResponse,
  DatabaseObjectResponse,
  UpdateDatabaseParameters,
  CreateDatabaseParameters,
  BlockObjectResponse,
  ListBlockChildrenResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {APIErrorCode, ClientErrorCode, isNotionClientError} from "@notionhq/client";
import {ignorePromiseError, retryOnCondition} from "./utils";
import {dog} from "./logging";
import {dev} from "./env";
import {createCodedRichText} from "./_notion";
import {NotionCodedTextPayload, NotionPropertyMetadata} from "./types";
import {PollUntil} from "poll-until-promise";

function retry<T>(func) {
  return retryOnCondition<T>(func, isNotionServerError, notionServerErrorMessage);
}
export function NotionAPI(accessToken) {
  // TODO: BREAKING CHANGE - Notion API 2025-09-03
  // Must update API version to "2025-09-03" and upgrade @notionhq/client to v5.0.0
  // Add notionVersion: "2025-09-03" to client config
  const notion = new Client({
    auth: accessToken,
    timeoutMs: 30000,
  });
  return {
    getDatabase: (id: string) =>
      retry<DatabaseObjectResponse>(() => notion.databases.retrieve({database_id: id})),
    updateDatabase: (id: string, properties: UpdateDatabaseParameters["properties"]) =>
      retry<UpdateDatabaseResponse>(() =>
        notion.databases.update({database_id: id, properties})
      ),
    getPage: (id: string) =>
      retry<GetPageResponse>(() => notion.pages.retrieve({page_id: id})),
    createPage: (...args: Parameters<typeof notion.pages.create>) =>
      retry<CreatePageResponse>(() => notion.pages.create(...args)),
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
      // TODO: BREAKING CHANGE - Notion API 2025-09-03
      // databases.query() may need data_source_id parameter
      // Check if querying specific data sources within databases
      retry<SearchResponse>(() =>
        notion.databases.query({
          database_id: dbId,
          page_size: limit || 100,
          ...query,
        })
      ),
    createDatabase: (payload: CreateDatabaseParameters) =>
      // TODO: BREAKING CHANGE - Notion API 2025-09-03
      // databases.create() now requires 'initial_data_source' wrapper:
      // OLD: { properties: {...} }
      // NEW: { initial_data_source: { properties: {...} } }
      // Must also update API version header to "2025-09-03"
      retry<DatabaseObjectResponse>(() => notion.databases.create(payload)),
    deletePage: (id: string) =>
      retry<UpdatePageResponse>(() => notion.pages.update({page_id: id, archived: true})),
  };
}

export function getNotionError(err: NotionClientError | any) {
  const isNtnError = isNotionClientError(err);
  const code = err?.code;
  const status = err?.status;
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
      status,
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

async function getBlockChildren(
  notion: Client,
  blockId: string,
  level: number = 0,
  maxLevel: number = 5
): Promise<ListBlockChildrenResponse["results"]> {
  if (level >= maxLevel) return [];

  const children = await notion.blocks.children.list({block_id: blockId});
  let allBlocks = [...children.results];

  // Recursively get children of each block
  for (const block of children.results) {
    if ("has_children" in block && block.has_children) {
      const childBlocks = await getBlockChildren(notion, block.id, level + 1, maxLevel);
      allBlocks = [...allBlocks, ...childBlocks];
    }
  }

  return allBlocks;
}

export async function findNotionInlineDatabases(tkn: string, pageId: string) {
  dog("Finding inline databases", pageId);

  const poll = new PollUntil({
    interval: 2500, // 2.5 seconds delay
    maxAttempts: 10, // 5 attempts max
    timeout: 30_000, // 30 second total timeout
    message:
      "Failed to fetch inline databases after exhausting max attempts, Please connect the database manually.",
  });

  try {
    const result = await poll.execute(async () => {
      try {
        // TODO: BREAKING CHANGE - Notion API 2025-09-03
        // Must add notionVersion: "2025-09-03" to client config
        const notion = new Client({
          auth: tkn,
          timeoutMs: 30000,
        });

        const allBlocks = await getBlockChildren(notion, pageId);
        const childDatabases = allBlocks.filter(
          (block: BlockObjectResponse) => block.type === "child_database"
        );

        const inlineDatabases = childDatabases.map((db) => {
          return {
            id: db.id,
            name: db.child_database.title,
          };
        });

        dog("Found inline databases", inlineDatabases);
        return inlineDatabases;
      } catch (error) {
        const isNotionError = isNotionClientError(error);
        if (isNotionError) {
          const isServerError = isNotionServerError(error.code);
          const isVldError = error.code === APIErrorCode.ValidationError;
          console.info("Got server error, While fetching inline databases", isServerError);
          console.info("Got validation error, While fetching inline databases", isVldError);
          if (isServerError || isVldError) {
            // Return false to trigger another retry
            return false;
          }
          // For other Notion errors, throw immediately
          throw error;
        }
        // For non-Notion errors, throw immediately
        throw error;
      }
    });

    return result;
  } catch (error) {
    console.error("Error finding inline database:", error);
    throw error;
  }
}

export function getNotionPropertyMetadata(
  metadata: NotionPropertyMetadata | string
): NotionPropertyMetadata {
  if (typeof metadata === "string") {
    return {
      name: metadata,
      id: undefined,
      type: undefined,
    };
  }
  return {
    name: metadata.name,
    id: metadata.id,
    type: metadata.type,
  };
}

export function getNotionProperty(
  metadata: NotionPropertyMetadata,
  properties: Record<string, any>
): {metadata: NotionPropertyMetadata; property: any; value: any} {
  // Find property by id first, then fallback to name
  const property =
    Object.values(properties).find((p) => p.id === metadata.id) || properties[metadata.name];
  const propertyType = property["type"];
  const value = property[propertyType];
  return {
    metadata: metadata,
    property: property,
    value: value,
  };
}
