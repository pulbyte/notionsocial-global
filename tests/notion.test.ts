import {Client} from "@notionhq/client";
import {resolveDataSourceId, __clearDataSourceLRU, NotionAPI} from "../src/notion";
import type {DataSourceStore} from "../src/types";

jest.mock("@notionhq/client");

const MockedClient = Client as jest.MockedClass<typeof Client>;

function makeClient(retrieve: jest.Mock, dsRetrieve?: jest.Mock): Client {
  // Default dsRetrieve to a 404 so the resolver falls through to `retrieve`
  // (database_id path) when a test doesn't care about the data_source-first
  // probe. Tests that exercise the data_source path pass their own mock.
  const dsRetrieveMock =
    dsRetrieve ??
    jest.fn().mockRejectedValue(
      Object.assign(new Error("Could not find data_source"), {
        code: "object_not_found",
        status: 404,
      })
    );
  const instance = {
    databases: {retrieve},
    dataSources: {retrieve: dsRetrieveMock},
  } as unknown as Client;
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

  it("propagates errors from databases.retrieve when data_source probe also fails", async () => {
    const err = Object.assign(new Error("Could not find database"), {
      code: "object_not_found",
      status: 404,
    });
    const retrieve = jest.fn().mockRejectedValue(err);
    const dsRetrieve = jest.fn().mockRejectedValue(
      Object.assign(new Error("Could not find data_source"), {
        code: "object_not_found",
        status: 404,
      })
    );
    const client = makeClient(retrieve, dsRetrieve);

    await expect(resolveDataSourceId(client, "db_deleted")).rejects.toBe(err);
  });

  it("propagates non-404 errors from the data_source probe (e.g. unauthorized)", async () => {
    const err = Object.assign(new Error("Unauthorized"), {
      code: "unauthorized",
      status: 401,
    });
    const retrieve = jest.fn();
    const dsRetrieve = jest.fn().mockRejectedValue(err);
    const client = makeClient(retrieve, dsRetrieve);

    await expect(resolveDataSourceId(client, "id_x")).rejects.toBe(err);
    // database retrieve must NOT be tried when the data_source probe fails
    // with a non-404 (token errors should surface immediately, not be masked
    // by a second 404 from the database lookup).
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("accepts a data_source_id and returns it verbatim when dataSources.retrieve succeeds", async () => {
    const retrieve = jest.fn();
    const dsRetrieve = jest.fn().mockResolvedValue({
      id: "ds_direct",
      object: "data_source",
      parent: {type: "database_id", database_id: "db_parent"},
      properties: {},
    });
    const client = makeClient(retrieve, dsRetrieve);
    const store = makeStore();

    const id = await resolveDataSourceId(client, "ds_direct", store);

    expect(id).toBe("ds_direct");
    expect(dsRetrieve).toHaveBeenCalledWith({data_source_id: "ds_direct"});
    // databases.retrieve should NOT be tried once the id is confirmed as a
    // data_source — that was the whole point of probing data_source first.
    expect(retrieve).not.toHaveBeenCalled();
    await new Promise((r) => setImmediate(r));
    expect(store.write).toHaveBeenCalledWith("ds_direct", "ds_direct");
  });

  it("caches data_source_id input so a second call skips both Notion endpoints", async () => {
    const retrieve = jest.fn();
    const dsRetrieve = jest.fn().mockResolvedValue({
      id: "ds_direct",
      object: "data_source",
      parent: {type: "database_id", database_id: "db_parent"},
      properties: {},
    });
    const client = makeClient(retrieve, dsRetrieve);

    await resolveDataSourceId(client, "ds_direct");
    await resolveDataSourceId(client, "ds_direct");

    expect(dsRetrieve).toHaveBeenCalledTimes(1);
    expect(retrieve).not.toHaveBeenCalled();
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
    const notFound = Object.assign(new Error("Could not find data_source"), {
      code: "object_not_found",
      status: 404,
    });
    const dbRetrieve = jest.fn().mockResolvedValue({
      id: "db_abc",
      object: "database",
      title: [{type: "text", text: {content: "My DB"}, plain_text: "My DB"}],
      cover: {type: "external", external: {url: "https://example.com/cover.png"}},
      url: "https://notion.so/db_abc",
      parent: {type: "page_id", page_id: "page_parent"},
      data_sources: [{id: "ds_primary", name: "Primary"}],
    });
    const dsRetrieve = jest.fn().mockImplementation(({data_source_id}) => {
      if (data_source_id === "db_abc") return Promise.reject(notFound);
      return Promise.resolve({
        id: "ds_primary",
        object: "data_source",
        properties: {Name: {id: "title", name: "Name", type: "title", title: {}}},
        parent: {type: "database_id", database_id: "db_abc"},
        archived: false,
      });
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
    // ds had no title, falls back to container
    expect(ndb.title[0].plain_text).toBe("My DB");
    expect(ndb.cover).toEqual({type: "external", external: {url: "https://example.com/cover.png"}});
    expect(ndb.url).toBe("https://notion.so/db_abc");
  });

  it("prefers data source title over container title (multi-source database)", async () => {
    const notFound = Object.assign(new Error("Could not find data_source"), {
      code: "object_not_found",
      status: 404,
    });
    const dbRetrieve = jest.fn().mockResolvedValue({
      id: "db_marketing",
      object: "database",
      title: [{type: "text", text: {content: "Marketing"}, plain_text: "Marketing"}],
      cover: null,
      url: "https://notion.so/db_marketing",
      parent: {type: "page_id", page_id: "p"},
      data_sources: [{id: "ds_q1", name: "Q1 Plan"}],
    });
    const dsRetrieve = jest.fn().mockImplementation(({data_source_id}) => {
      if (data_source_id === "db_marketing") return Promise.reject(notFound);
      return Promise.resolve({
        id: "ds_q1",
        object: "data_source",
        title: [{type: "text", text: {content: "Q1 Plan"}, plain_text: "Q1 Plan"}],
        parent: {type: "database_id", database_id: "db_marketing"},
        properties: {},
      });
    });
    MockedClient.mockImplementation(
      () =>
        ({
          databases: {retrieve: dbRetrieve},
          dataSources: {retrieve: dsRetrieve},
        } as unknown as Client)
    );

    const ndb = await NotionAPI("tkn").getDatabase("db_marketing");

    expect(ndb.id).toBe("ds_q1");
    // data source title wins over container "Marketing"
    expect(ndb.title[0].plain_text).toBe("Q1 Plan");
    // cover/url still come from container
    expect(ndb.url).toBe("https://notion.so/db_marketing");
  });

  it("accepts a data_source_id and reads container from its parent.database_id", async () => {
    const dbRetrieve = jest.fn().mockResolvedValue({
      id: "db_parent",
      object: "database",
      title: [{type: "text", text: {content: "Parent"}, plain_text: "Parent"}],
      cover: null,
      url: "https://notion.so/db_parent",
      parent: {type: "page_id", page_id: "p"},
      data_sources: [{id: "ds_direct", name: "Direct"}],
    });
    const dsRetrieve = jest.fn().mockResolvedValue({
      id: "ds_direct",
      object: "data_source",
      title: [{type: "text", text: {content: "Direct DS"}, plain_text: "Direct DS"}],
      parent: {type: "database_id", database_id: "db_parent"},
      properties: {Name: {id: "title", name: "Name", type: "title", title: {}}},
      archived: false,
    });
    MockedClient.mockImplementation(
      () =>
        ({
          databases: {retrieve: dbRetrieve},
          dataSources: {retrieve: dsRetrieve},
        } as unknown as Client)
    );

    const ndb = await NotionAPI("tkn").getDatabase("ds_direct");

    expect(ndb.id).toBe("ds_direct");
    // The data source's own title is preferred over the container "Parent".
    expect(ndb.title[0].plain_text).toBe("Direct DS");
    expect(ndb.url).toBe("https://notion.so/db_parent");
    expect(dbRetrieve).toHaveBeenCalledWith({database_id: "db_parent"});
    // databases.retrieve is only called once (for the container fetch), not
    // for an initial 404 probe — because the data_source probe ran first
    // and succeeded.
    expect(dbRetrieve).toHaveBeenCalledTimes(1);
  });

  it("returns a data_source_id-only schema when the data source has no database parent", async () => {
    const dbRetrieve = jest.fn();
    const dsRetrieve = jest.fn().mockResolvedValue({
      id: "ds_synced",
      object: "data_source",
      parent: {type: "data_source_id", data_source_id: "ds_other"},
      properties: {},
    });
    MockedClient.mockImplementation(
      () =>
        ({
          databases: {retrieve: dbRetrieve},
          dataSources: {retrieve: dsRetrieve},
        } as unknown as Client)
    );

    const ndb = await NotionAPI("tkn").getDatabase("ds_synced");

    expect(ndb.id).toBe("ds_synced");
    expect(ndb.title).toEqual([]);
    expect(ndb.cover).toBeNull();
    expect(ndb.url).toBe("");
    // No container exists — databases.retrieve must NOT be called.
    expect(dbRetrieve).not.toHaveBeenCalled();
  });

  it("fetches the container on every call (for fresh title/cover/url)", async () => {
    const notFound = Object.assign(new Error("Could not find data_source"), {
      code: "object_not_found",
      status: 404,
    });
    const dbRetrieve = jest.fn().mockResolvedValue({
      id: "db_abc",
      title: [],
      cover: null,
      url: "",
      parent: {type: "page_id", page_id: "p"},
      data_sources: [{id: "ds_primary", name: "Primary"}],
    });
    const dsRetrieve = jest.fn().mockImplementation(({data_source_id}) => {
      if (data_source_id === "db_abc") return Promise.reject(notFound);
      return Promise.resolve({
        id: "ds_primary",
        properties: {},
        parent: {type: "database_id", database_id: "db_abc"},
      });
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

    // dbRetrieve fires every call to keep title/cover/url fresh.
    // call 1: resolve() runs dbRetrieve once after probe 404 → caches.
    //         then getDatabase parallel: dbRetrieve once + dsRetrieve(ds_primary) once.
    // call 2: resolve() hits cache. getDatabase parallel: dbRetrieve once + dsRetrieve(ds_primary) once.
    expect(dbRetrieve).toHaveBeenCalledTimes(3);
    // dsRetrieve fired with ds_primary twice (once per getDatabase) + the
    // initial 404 probe.
    expect(dsRetrieve).toHaveBeenCalledTimes(3);
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
    const dsRetrieve = jest.fn().mockRejectedValue(
      Object.assign(new Error("Could not find data_source"), {
        code: "object_not_found",
        status: 404,
      })
    );
    const pagesCreate = jest.fn().mockResolvedValue({id: "page_new", object: "page"});
    MockedClient.mockImplementation(
      () =>
        ({
          databases: {retrieve: dbRetrieve},
          dataSources: {retrieve: dsRetrieve},
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
