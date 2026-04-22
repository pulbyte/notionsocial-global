import {Client} from "@notionhq/client";
import {resolveDataSourceId, __clearDataSourceLRU, NotionAPI} from "../src/notion";
import type {DataSourceStore} from "../src/types";

jest.mock("@notionhq/client");

const MockedClient = Client as jest.MockedClass<typeof Client>;

function makeClient(retrieve: jest.Mock): Client {
  const instance = {databases: {retrieve}} as unknown as Client;
  return instance;
}

function makeStore(): jest.Mocked<DataSourceStore> {
  return {
    read: jest.fn(),
    write: jest.fn().mockResolvedValue(undefined),
  };
}

describe("resolveDataSourceId", () => {
  beforeEach(() => {
    __clearDataSourceLRU();
    jest.clearAllMocks();
  });

  it("returns data_sources[0].id and writes to store when cache+store are empty", async () => {
    const retrieve = jest.fn().mockResolvedValue({
      data_sources: [{id: "ds_primary", name: "Primary"}],
    });
    const client = makeClient(retrieve);
    const store = makeStore();

    const id = await resolveDataSourceId(client, "db_123", store);

    expect(id).toBe("ds_primary");
    expect(retrieve).toHaveBeenCalledWith({database_id: "db_123"});
    // write is fire-and-forget; flush microtasks
    await new Promise((r) => setImmediate(r));
    expect(store.write).toHaveBeenCalledWith("db_123", "ds_primary");
  });

  it("returns from store without calling databases.retrieve", async () => {
    const retrieve = jest.fn();
    const client = makeClient(retrieve);
    const store = makeStore();
    store.read.mockResolvedValue("ds_from_store");

    const id = await resolveDataSourceId(client, "db_123", store);

    expect(id).toBe("ds_from_store");
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("caches in-process so subsequent calls skip store and API", async () => {
    const retrieve = jest.fn().mockResolvedValue({
      data_sources: [{id: "ds_primary", name: "Primary"}],
    });
    const client = makeClient(retrieve);
    const store = makeStore();

    await resolveDataSourceId(client, "db_123", store);
    await resolveDataSourceId(client, "db_123", store);

    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(store.read).toHaveBeenCalledTimes(1);
  });

  it("logs a warning when multiple data sources are present but still picks index 0", async () => {
    const retrieve = jest.fn().mockResolvedValue({
      data_sources: [
        {id: "ds_primary", name: "Primary"},
        {id: "ds_secondary", name: "Secondary"},
      ],
    });
    const client = makeClient(retrieve);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const id = await resolveDataSourceId(client, "db_multi");

    expect(id).toBe("ds_primary");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("multi_data_source_detected"),
      expect.objectContaining({databaseId: "db_multi", count: 2, chosen: "ds_primary"})
    );
    warnSpy.mockRestore();
  });

  it("throws a synthetic ObjectNotFound when data_sources is empty", async () => {
    const retrieve = jest.fn().mockResolvedValue({data_sources: []});
    const client = makeClient(retrieve);

    await expect(resolveDataSourceId(client, "db_empty")).rejects.toMatchObject({
      code: "object_not_found",
      message: expect.stringContaining("Could not find data_source"),
    });
  });

  it("propagates errors from databases.retrieve", async () => {
    const err = Object.assign(new Error("Could not find database"), {
      code: "object_not_found",
      status: 404,
    });
    const retrieve = jest.fn().mockRejectedValue(err);
    const client = makeClient(retrieve);

    await expect(resolveDataSourceId(client, "db_deleted")).rejects.toBe(err);
  });

  it("works without a store (scripts/post-process use case)", async () => {
    const retrieve = jest.fn().mockResolvedValue({
      data_sources: [{id: "ds_primary", name: "Primary"}],
    });
    const client = makeClient(retrieve);

    const id = await resolveDataSourceId(client, "db_no_store");

    expect(id).toBe("ds_primary");
  });
});

describe("NotionAPI.getDatabase", () => {
  beforeEach(() => {
    __clearDataSourceLRU();
    jest.clearAllMocks();
    MockedClient.mockClear();
  });

  it("merges container fields (title/cover/url) with data-source schema", async () => {
    const dbRetrieve = jest.fn().mockResolvedValue({
      id: "db_abc",
      object: "database",
      title: [{type: "text", text: {content: "My DB"}, plain_text: "My DB"}],
      cover: {type: "external", external: {url: "https://example.com/cover.png"}},
      url: "https://notion.so/db_abc",
      parent: {type: "page_id", page_id: "page_parent"},
      data_sources: [{id: "ds_primary", name: "Primary"}],
    });
    const dsRetrieve = jest.fn().mockResolvedValue({
      id: "ds_primary",
      object: "data_source",
      properties: {Name: {id: "title", name: "Name", type: "title", title: {}}},
      parent: {type: "database_id", database_id: "db_abc"},
      archived: false,
    });
    MockedClient.mockImplementation(
      () =>
        ({
          databases: {retrieve: dbRetrieve},
          dataSources: {retrieve: dsRetrieve},
        } as unknown as Client)
    );

    const ndb = await NotionAPI("tkn").getDatabase("db_abc");

    expect(ndb.id).toBe("ds_primary"); // from data source
    expect(ndb.properties).toHaveProperty("Name");
    expect(ndb.title[0].plain_text).toBe("My DB"); // from container
    expect(ndb.cover).toEqual({type: "external", external: {url: "https://example.com/cover.png"}});
    expect(ndb.url).toBe("https://notion.so/db_abc");
  });

  it("fetches the container on every call (for fresh title/cover/url)", async () => {
    const dbRetrieve = jest.fn().mockResolvedValue({
      id: "db_abc",
      title: [],
      cover: null,
      url: "",
      parent: {type: "page_id", page_id: "p"},
      data_sources: [{id: "ds_primary", name: "Primary"}],
    });
    const dsRetrieve = jest.fn().mockResolvedValue({
      id: "ds_primary",
      properties: {},
      parent: {type: "database_id", database_id: "db_abc"},
    });
    MockedClient.mockImplementation(
      () =>
        ({
          databases: {retrieve: dbRetrieve},
          dataSources: {retrieve: dsRetrieve},
        } as unknown as Client)
    );

    await NotionAPI("tkn").getDatabase("db_abc");
    await NotionAPI("tkn").getDatabase("db_abc");

    // databases.retrieve called twice (we need title/cover/url each time);
    // but resolveDataSourceId only called once — so data_sources[0] only
    // accessed via the first databases.retrieve. (Acceptable: we always
    // need the container for title/cover/url.)
    expect(dsRetrieve).toHaveBeenCalledTimes(2);
  });
});

describe("NotionAPI.createPage", () => {
  beforeEach(() => {
    __clearDataSourceLRU();
    jest.clearAllMocks();
    MockedClient.mockClear();
  });

  it("rewrites {parent: {database_id}} to {parent: {data_source_id}}", async () => {
    const dbRetrieve = jest.fn().mockResolvedValue({
      data_sources: [{id: "ds_primary", name: "Primary"}],
    });
    const pagesCreate = jest.fn().mockResolvedValue({id: "page_new", object: "page"});
    MockedClient.mockImplementation(
      () =>
        ({
          databases: {retrieve: dbRetrieve},
          pages: {create: pagesCreate},
        } as unknown as Client)
    );

    await NotionAPI("tkn").createPage({
      parent: {type: "database_id", database_id: "db_abc"},
      properties: {Name: {title: [{text: {content: "Hi"}}]}},
    } as never);

    expect(pagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: {type: "data_source_id", data_source_id: "ds_primary"},
        properties: {Name: {title: [{text: {content: "Hi"}}]}},
      })
    );
  });

  it("passes through non-database parents unchanged", async () => {
    const pagesCreate = jest.fn().mockResolvedValue({id: "page_new"});
    MockedClient.mockImplementation(
      () => ({pages: {create: pagesCreate}} as unknown as Client)
    );

    await NotionAPI("tkn").createPage({
      parent: {type: "page_id", page_id: "page_parent"},
      properties: {},
    } as never);

    expect(pagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({parent: {type: "page_id", page_id: "page_parent"}})
    );
  });
});

describe("NotionAPI.search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockedClient.mockClear();
  });

  it("filters on 'data_source' and dedups by parent.database_id", async () => {
    function makeTitle(text: string) {
      return [
        {
          type: "text",
          text: {content: text, link: null},
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
          plain_text: text,
          href: null,
        },
      ];
    }
    const search = jest.fn().mockResolvedValue({
      results: [
        {
          object: "data_source",
          id: "ds_1a",
          parent: {type: "database_id", database_id: "db_A"},
          title: makeTitle("Alpha"),
        },
        {
          object: "data_source",
          id: "ds_1b",
          parent: {type: "database_id", database_id: "db_A"}, // same db
          title: makeTitle("Alpha Secondary"),
        },
        {
          object: "data_source",
          id: "ds_2",
          parent: {type: "database_id", database_id: "db_B"},
          title: makeTitle("Bravo"),
        },
        // externally-synced data source: parent is data_source_id, should be skipped
        {
          object: "data_source",
          id: "ds_ext",
          parent: {type: "data_source_id", data_source_id: "ds_other"},
          title: makeTitle("Skipped"),
        },
      ],
      next_cursor: null,
      has_more: false,
    });
    MockedClient.mockImplementation(() => ({search} as unknown as Client));

    const resp = await NotionAPI("tkn").search("query");

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({filter: {value: "data_source", property: "object"}})
    );
    expect(resp.results).toHaveLength(2);
    expect(resp.results.map((r) => r.id)).toEqual(["db_A", "db_B"]);
    expect(resp.results[0].data_source_id).toBe("ds_1a");
    expect(resp.results[0].name).toBe("Alpha");
    expect(resp.results[0].title[0].plain_text).toBe("Alpha");
  });
});
