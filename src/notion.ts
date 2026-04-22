import {Client, NotionClientError} from "@notionhq/client";
import {
  BlockObjectResponse,
  CreateDatabaseParameters,
  CreatePageParameters,
  CreatePageResponse,
  DatabaseObjectResponse,
  GetDataSourceResponse,
  GetPageResponse,
  ListBlockChildrenResponse,
  QueryDataSourceParameters,
  QueryDataSourceResponse,
  SearchResponse,
  UpdateDataSourceParameters,
  UpdateDataSourceResponse,
  UpdatePageResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {APIErrorCode, ClientErrorCode, isNotionClientError} from "@notionhq/client";
import {ignorePromiseError, retryOnCondition} from "./utils";
import {dog} from "./logging";
import {dev} from "./env";
import {createCodedRichText} from "./_notion";
import {
  DataSourceStore,
  NotionCodedTextPayload,
  NotionDatabaseSchema,
  NotionPropertyMetadata,
} from "./types";
import {PollUntil} from "poll-until-promise";

// In-process cache for database_id → data_source_id.
// Workspace-global mapping; token-independent. TTL 15 min, max 1000 entries.
type CacheEntry = {value: string; expiresAt: number};
const dataSourceLRU = new Map<string, CacheEntry>();
const DS_CACHE_TTL_MS = 15 * 60 * 1000;
const DS_CACHE_MAX = 1000;

function cacheGet(databaseId: string): string | undefined {
  const entry = dataSourceLRU.get(databaseId);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    dataSourceLRU.delete(databaseId);
    return undefined;
  }
  // Refresh insertion order for LRU eviction
  dataSourceLRU.delete(databaseId);
  dataSourceLRU.set(databaseId, entry);
  return entry.value;
}

function cacheSet(databaseId: string, dataSourceId: string): void {
  if (dataSourceLRU.size >= DS_CACHE_MAX) {
    const oldest = dataSourceLRU.keys().next().value;
    if (oldest) dataSourceLRU.delete(oldest);
  }
  dataSourceLRU.set(databaseId, {
    value: dataSourceId,
    expiresAt: Date.now() + DS_CACHE_TTL_MS,
  });
}

/** Test-only: clears the in-process data-source cache. Not exported from package root. */
export function __clearDataSourceLRU(): void {
  dataSourceLRU.clear();
}

export async function resolveDataSourceId(
  notion: Client,
  databaseId: string,
  store?: DataSourceStore
): Promise<string> {
  const cached = cacheGet(databaseId);
  if (cached) return cached;

  if (store) {
    try {
      const stored = await store.read(databaseId);
      if (stored) {
        cacheSet(databaseId, stored);
        return stored;
      }
    } catch (err) {
      console.warn("data_source_store_read_failed", {databaseId, err: String(err)});
      // Fall through to API lookup
    }
  }

  const container = await notion.databases.retrieve({database_id: databaseId});
  const dataSources = (container as {data_sources?: Array<{id: string; name: string}>})
    .data_sources;

  if (!dataSources || dataSources.length === 0) {
    const err = Object.assign(new Error("Could not find data_source for database"), {
      code: "object_not_found",
      status: 404,
    });
    throw err;
  }

  if (dataSources.length > 1) {
    console.warn("multi_data_source_detected", {
      databaseId,
      count: dataSources.length,
      chosen: dataSources[0].id,
    });
  }

  const chosen = dataSources[0].id;
  cacheSet(databaseId, chosen);

  if (store) {
    // Fire-and-forget; never block the caller
    store.write(databaseId, chosen).catch((err) => {
      console.warn("data_source_store_write_failed", {databaseId, err: String(err)});
    });
  }

  return chosen;
}

function retry<T>(func) {
  return retryOnCondition<T>(func, isNotionServerError, notionServerErrorMessage);
}
export function NotionAPI(accessToken: string, opts?: {store?: DataSourceStore}) {
  const notion = new Client({
    auth: accessToken,
    notionVersion: "2025-09-03",
    timeoutMs: 30000,
  });
  const store = opts?.store;

  function resolve(databaseId: string) {
    return resolveDataSourceId(notion, databaseId, store);
  }

  return {
    /**
     * Returns the data source's schema merged with container-level
     * title/cover/url. Preserves the v4 caller contract even though the
     * underlying endpoint split into databases + dataSources.
     */
    getDatabase: async (id: string): Promise<NotionDatabaseSchema> =>
      retry<NotionDatabaseSchema>(async () => {
        const dsId = await resolve(id);
        const [container, ds] = await Promise.all([
          notion.databases.retrieve({database_id: id}) as Promise<DatabaseObjectResponse>,
          notion.dataSources.retrieve({data_source_id: dsId}) as Promise<GetDataSourceResponse>,
        ]);
        return {
          ...ds,
          title: container.title,
          cover: container.cover,
          url: container.url,
        };
      }),

    /**
     * Raw database container fetch. Use only when you genuinely need the
     * list of data_sources (e.g. multi-source UI). Most code wants
     * getDatabase() instead.
     */
    getDatabaseContainer: (id: string) =>
      retry<DatabaseObjectResponse>(
        () =>
          notion.databases.retrieve({database_id: id}) as Promise<DatabaseObjectResponse>
      ),

    updateDatabase: (id: string, properties: UpdateDataSourceParameters["properties"]) =>
      retry<UpdateDataSourceResponse>(async () => {
        const dsId = await resolve(id);
        return notion.dataSources.update({data_source_id: dsId, properties});
      }),

    query: (
      dbId: string,
      query: Omit<QueryDataSourceParameters, "data_source_id" | "page_size">,
      limit?: number
    ) =>
      retry<QueryDataSourceResponse>(async () => {
        const dsId = await resolve(dbId);
        return notion.dataSources.query({
          data_source_id: dsId,
          page_size: limit ?? 100,
          ...query,
        });
      }),

    createDatabase: (payload: CreateDatabaseParameters) => {
      // Wrap v4-style {properties} into v5-style {initial_data_source: {properties}}.
      const {properties, ...rest} = payload as CreateDatabaseParameters & {
        properties?: unknown;
      };
      const v5Payload = properties
        ? ({...rest, initial_data_source: {properties}} as CreateDatabaseParameters)
        : payload;
      return retry<DatabaseObjectResponse>(
        () => notion.databases.create(v5Payload) as Promise<DatabaseObjectResponse>
      );
    },

    getPage: (id: string) =>
      retry<GetPageResponse>(() => notion.pages.retrieve({page_id: id})),

    createPage: async (args: CreatePageParameters) => {
      // Parent rewrite: {database_id} → {data_source_id} for data-source-parented pages.
      const parent = args.parent as {type?: string; database_id?: string} & Record<
        string,
        unknown
      >;
      let finalArgs = args;
      if (parent && "database_id" in parent && parent.database_id) {
        const dsId = await resolve(parent.database_id);
        finalArgs = {
          ...args,
          parent: {type: "data_source_id", data_source_id: dsId},
        } as CreatePageParameters;
      }
      return retry<CreatePageResponse>(() => notion.pages.create(finalArgs));
    },

    updatePage: (id: string, properties: Record<string, unknown>) =>
      retry<UpdatePageResponse>(() =>
        notion.pages.update({
          page_id: id,
          properties: properties as never,
          archived: false,
        })
      ),

    /**
     * Searches data_sources (v5 filter) and returns a v4-compatible
     * result shape: each result item has id === database_id so existing
     * frontend consumers and callers that treat results as databases
     * keep working. Results are deduped by parent database_id (databases
     * with multiple data sources appear once; we pick data_sources[0]).
     */
    search: (query: string, nextCursor: string = "", limit?: number) =>
      retry<{
        results: Array<{
          id: string;
          data_source_id: string;
          title: DatabaseObjectResponse["title"];
          name: string;
          url: string;
          object: "database";
        }>;
        next_cursor: string | null;
        has_more: boolean;
      }>(async () => {
        const raw = (await notion.search({
          query,
          filter: {value: "data_source", property: "object"},
          sort: {direction: "descending", timestamp: "last_edited_time"},
          page_size: nextCursor ? 100 : limit || 25,
          ...(nextCursor && {start_cursor: nextCursor}),
        })) as SearchResponse;

        const seen = new Set<string>();
        const results: Array<{
          id: string;
          data_source_id: string;
          title: DatabaseObjectResponse["title"];
          name: string;
          url: string;
          object: "database";
        }> = [];

        for (const item of raw.results) {
          // v5 search returns DataSourceObjectResponse items (and PartialDataSourceObjectResponse
          // for integrations without full access, which we skip because they lack `parent`/`title`).
          // Each full response carries `title: RichTextItemResponse[]` and a `parent` that either
          // points to the wrapping database (`{type: "database_id", database_id}`) or another data
          // source (`{type: "data_source_id", ...}` for externally synced sources). Skip the latter
          // for our use case (we want database-level dedup).
          const anyItem = item as unknown as {
            object?: string;
            id: string;
            parent?: {type: string; database_id?: string};
            title?: DatabaseObjectResponse["title"];
          };
          if (anyItem.object !== "data_source" || !anyItem.parent || !anyItem.title) continue;
          const dbId =
            anyItem.parent.type === "database_id" ? anyItem.parent.database_id : undefined;
          if (!dbId || seen.has(dbId)) continue;
          seen.add(dbId);

          const title = anyItem.title ?? [];
          const nameStr = title
            .map((rt) => (rt as {plain_text?: string}).plain_text ?? "")
            .join("");

          results.push({
            id: dbId,
            data_source_id: anyItem.id,
            title,
            name: nameStr,
            url: `https://www.notion.so/${dbId.replace(/-/g, "")}`,
            object: "database",
          });
        }

        return {
          results,
          next_cursor: raw.next_cursor,
          has_more: raw.has_more,
        };
      }),

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
        const notion = new Client({
          auth: tkn,
          notionVersion: "2025-09-03",
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
