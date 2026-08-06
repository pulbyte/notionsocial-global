import {parseNotionInput, containerCandidates, directBranch, mergeCandidates, pageBranch} from "../src/notion-discovery";
import type {Client} from "@notionhq/client";
import type {DiscoveryCandidate} from "../src/types";

const ID = "3f2a8b1c4d5e6f708192a3b4c5d6e7f8";
const HYPHENATED = "3f2a8b1c-4d5e-6f70-8192-a3b4c5d6e7f8";

const CONTAINER = {
  object: "database",
  id: "3f2a8b1c-4d5e-6f70-8192-a3b4c5d6e7f8",
  url: "https://www.notion.so/3f2a8b1c4d5e6f708192a3b4c5d6e7f8",
  icon: {type: "emoji", emoji: "📅"},
  title: [{plain_text: "Content DB"}],
  data_sources: [
    {id: "ds-111", name: "Content Calendar"},
    {id: "ds-222", name: "Archive 2025"},
  ],
};

function notFoundErr() {
  return Object.assign(new Error("Could not find data_source"), {
    code: "object_not_found",
    status: 404,
  });
}

describe("parseNotionInput", () => {
  it("returns empty for blank input", () => {
    expect(parseNotionInput("")).toEqual({kind: "empty"});
    expect(parseNotionInput("   ")).toEqual({kind: "empty"});
  });

  it("parses a bare hyphen-less id", () => {
    expect(parseNotionInput(ID)).toEqual({kind: "id", id: ID, fromUrl: false});
  });

  it("parses a bare hyphenated uuid", () => {
    expect(parseNotionInput(HYPHENATED)).toEqual({kind: "id", id: ID, fromUrl: false});
  });

  it("parses a notion.so URL with a name slug", () => {
    expect(parseNotionInput(`https://www.notion.so/Content-Hub-${ID}`)).toEqual({
      kind: "id", id: ID, fromUrl: true, slugText: "Content Hub",
    });
  });

  it("parses a notion.com URL with workspace prefix", () => {
    expect(parseNotionInput(`https://notion.com/myteam/Content-Hub-${ID}`)).toEqual({
      kind: "id", id: ID, fromUrl: true, slugText: "Content Hub",
    });
  });

  it("ignores the ?v= view param and uses the path id", () => {
    expect(
      parseNotionInput(`https://notion.so/Content-Hub-${ID}?v=aaaabbbbccccddddeeeeffff00001111`)
    ).toEqual({kind: "id", id: ID, fromUrl: true, slugText: "Content Hub"});
  });

  it("prefers the ?p= peek page id over the path id", () => {
    const peek = "aaaabbbbccccddddeeeeffff00001111";
    expect(
      parseNotionInput(`https://notion.so/Content-Hub-${ID}?p=${peek}&pm=s`)
    ).toEqual({kind: "id", id: peek, fromUrl: true, slugText: "Content Hub"});
  });

  it("treats a notion URL without an id as text from the slug", () => {
    expect(parseNotionInput("https://notion.so/Content-Hub")).toEqual({
      kind: "text", text: "Content Hub",
    });
  });

  it("treats a non-notion URL with no id as empty", () => {
    expect(parseNotionInput("https://example.com/")).toEqual({kind: "empty"});
  });

  it("treats plain words as text", () => {
    expect(parseNotionInput("Content Calendar")).toEqual({kind: "text", text: "Content Calendar"});
  });
});

describe("containerCandidates", () => {
  it("emits one candidate per data source, first as direct, rest as sibling", () => {
    const out = containerCandidates(CONTAINER);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      id: "3f2a8b1c4d5e6f708192a3b4c5d6e7f8",
      data_source_id: "ds-111",
      title: "Content Calendar",
      icon: "📅",
      source: "direct",
    });
    expect(out[1]).toMatchObject({data_source_id: "ds-222", source: "sibling_source"});
  });

  it("marks the preferred data source as direct even when not first", () => {
    const out = containerCandidates(CONTAINER, "ds-222");
    expect(out.find((c) => c.data_source_id === "ds-222")?.source).toBe("direct");
    expect(out.find((c) => c.data_source_id === "ds-111")?.source).toBe("sibling_source");
  });

  it("falls back to first source when preferred data source is not found", () => {
    const out = containerCandidates(CONTAINER, "ds-nonexistent");
    expect(out.find((c) => c.data_source_id === "ds-111")?.source).toBe("direct");
    expect(out.find((c) => c.data_source_id === "ds-222")?.source).toBe("sibling_source");
  });
});

describe("directBranch", () => {
  it("resolves a data_source id to its container's candidates", async () => {
    const notion = {
      dataSources: {
        retrieve: jest.fn().mockResolvedValue({
          object: "data_source",
          id: "ds-222",
          parent: {type: "database_id", database_id: CONTAINER.id},
        }),
      },
      databases: {retrieve: jest.fn().mockResolvedValue(CONTAINER)},
    } as unknown as Client;
    const out = await directBranch(notion, "ds-222");
    expect(out.find((c) => c.data_source_id === "ds-222")?.source).toBe("direct");
  });

  it("falls back to database retrieve when data_source lookup 404s", async () => {
    const notion = {
      dataSources: {retrieve: jest.fn().mockRejectedValue(notFoundErr())},
      databases: {retrieve: jest.fn().mockResolvedValue(CONTAINER)},
    } as unknown as Client;
    const out = await directBranch(notion, "3f2a8b1c4d5e6f708192a3b4c5d6e7f8");
    expect(out).toHaveLength(2);
  });

  it("propagates non-404 errors", async () => {
    const authErr = Object.assign(new Error("Unauthorized"), {code: "unauthorized", status: 401});
    const notion = {
      dataSources: {retrieve: jest.fn().mockRejectedValue(authErr)},
      databases: {retrieve: jest.fn()},
    } as unknown as Client;
    await expect(directBranch(notion, "3f2a8b1c4d5e6f708192a3b4c5d6e7f8")).rejects.toThrow(
      "Unauthorized"
    );
  });

  it("propagates errors from parent container fetch after successful data_source resolve", async () => {
    const containerNotFoundErr = Object.assign(new Error("Database not found"), {
      code: "object_not_found",
      status: 404,
    });
    const datasourceRetrieve = jest.fn().mockResolvedValue({
      object: "data_source",
      id: "ds-222",
      parent: {type: "database_id", database_id: "parent-db-id"},
    });
    const databasesRetrieve = jest.fn().mockRejectedValue(containerNotFoundErr);
    const notion = {
      dataSources: {retrieve: datasourceRetrieve},
      databases: {retrieve: databasesRetrieve},
    } as unknown as Client;
    await expect(directBranch(notion, "ds-222")).rejects.toThrow("Database not found");
    expect(databasesRetrieve).toHaveBeenCalledTimes(1);
    expect(databasesRetrieve).toHaveBeenCalledWith({database_id: "parent-db-id"});
  });
});

describe("mergeCandidates", () => {
  const mk = (ds: string, source: DiscoveryCandidate["source"]): DiscoveryCandidate => ({
    id: "db1", data_source_id: ds, title: "T", icon: null, url: "", breadcrumb: [], source,
  });
  it("dedupes by data_source_id keeping the best-ranked source", () => {
    const out = mergeCandidates([
      [mk("a", "workspace_search"), mk("b", "sibling_source")],
      [mk("a", "direct")],
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({data_source_id: "a", source: "direct"});
    expect(out[1]).toMatchObject({data_source_id: "b", source: "sibling_source"});
  });
});

describe("pageBranch", () => {
  const ROW_PAGE = {
    object: "page",
    id: "page-row-1",
    parent: {type: "data_source_id", data_source_id: "ds-111", database_id: CONTAINER.id},
    properties: {Name: {type: "title", title: [{plain_text: "My post"}]}},
  };

  const PLAIN_PAGE = {
    object: "page",
    id: "page-plain-1",
    parent: {type: "workspace", workspace: true},
    properties: {title: {type: "title", title: [{plain_text: "Content Hub"}]}},
  };

  it("resolves a row page to its containing database as parent_of_row", async () => {
    const notion = {
      pages: {retrieve: jest.fn().mockResolvedValue(ROW_PAGE)},
      databases: {retrieve: jest.fn().mockResolvedValue(CONTAINER)},
      blocks: {children: {list: jest.fn()}},
    } as unknown as Client;
    const out = await pageBranch(notion, "page-row-1");
    const row = out.find((c) => c.data_source_id === "ds-111");
    expect(row?.source).toBe("parent_of_row");
    expect(notion.blocks.children.list).not.toHaveBeenCalled();
  });

  it("scans a plain page's children for inline databases as found_in_link", async () => {
    const notion = {
      pages: {retrieve: jest.fn().mockResolvedValue(PLAIN_PAGE)},
      blocks: {
        children: {
          list: jest.fn().mockResolvedValue({
            results: [
              {type: "paragraph", id: "b1"},
              {type: "child_database", id: CONTAINER.id, child_database: {title: "Content DB"}},
            ],
          }),
        },
      },
      databases: {retrieve: jest.fn().mockResolvedValue(CONTAINER)},
    } as unknown as Client;
    const out = await pageBranch(notion, "page-plain-1");
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].source).toBe("found_in_link");
    expect(out[0].breadcrumb).toEqual(["Content Hub"]);
  });

  it("propagates not-found so the orchestrator can classify no-access", async () => {
    const notion = {
      pages: {retrieve: jest.fn().mockRejectedValue(notFoundErr())},
    } as unknown as Client;
    await expect(pageBranch(notion, "nope")).rejects.toMatchObject({code: "object_not_found"});
  });
});

import {discoverNotionDatabases} from "../src/notion-discovery";

function searchResponse(items: Array<{id: string; ds: string; name: string}>) {
  return {
    results: items.map((i) => ({
      object: "data_source",
      id: i.ds,
      parent: {type: "database_id", database_id: i.id},
      title: [{plain_text: i.name}],
    })),
    next_cursor: null,
    has_more: false,
  };
}

function mockClient(overrides: Partial<Record<string, unknown>> = {}): Client {
  return {
    dataSources: {retrieve: jest.fn().mockRejectedValue(notFoundErr())},
    databases: {retrieve: jest.fn().mockRejectedValue(notFoundErr())},
    pages: {retrieve: jest.fn().mockRejectedValue(notFoundErr())},
    blocks: {children: {list: jest.fn().mockResolvedValue({results: []})}},
    search: jest.fn().mockResolvedValue(searchResponse([])),
    ...overrides,
  } as unknown as Client;
}

describe("discoverNotionDatabases", () => {
  it("returns nothing_found immediately for empty input", async () => {
    const result = await discoverNotionDatabases("tkn", "", {notionClient: mockClient()});
    expect(result.status).toBe("nothing_found");
    expect(result.candidates).toEqual([]);
  });

  it("returns ok with direct candidates for a database id", async () => {
    const client = mockClient({
      databases: {retrieve: jest.fn().mockResolvedValue(CONTAINER)},
    });
    const result = await discoverNotionDatabases(
      "tkn", "3f2a8b1c4d5e6f708192a3b4c5d6e7f8", {notionClient: client}
    );
    expect(result.status).toBe("ok");
    expect(result.candidates.map((c) => c.source)).toEqual(["direct", "sibling_source"]);
  });

  it("classifies unreachable pasted-URL ids with empty search as no_access", async () => {
    const result = await discoverNotionDatabases(
      "tkn", "https://notion.so/Secret-DB-3f2a8b1c4d5e6f708192a3b4c5d6e7f8",
      {notionClient: mockClient()}
    );
    expect(result.status).toBe("no_access");
  });

  it("falls back to workspace search from the URL slug", async () => {
    const client = mockClient({
      search: jest.fn().mockResolvedValue(
        searchResponse([{id: "db-9", ds: "ds-9", name: "Secret DB (copy)"}])
      ),
    });
    const result = await discoverNotionDatabases(
      "tkn", "https://notion.so/Secret-DB-3f2a8b1c4d5e6f708192a3b4c5d6e7f8",
      {notionClient: client}
    );
    expect(result.status).toBe("ok");
    expect(result.candidates[0]).toMatchObject({source: "workspace_search", title: "Secret DB (copy)"});
  });

  it("surfaces sibling data sources from the same container instead of collapsing to one", async () => {
    // Regression test: searchBranch used to dedupe by container (database_id),
    // silently dropping every data source after the first for a multi-source
    // container. A typed-name search must return a distinct candidate per
    // data source, not one card per container.
    const client = mockClient({
      search: jest.fn().mockResolvedValue(
        searchResponse([
          {id: "dbmulti", ds: "ds-a", name: "Q1 Plan"},
          {id: "dbmulti", ds: "ds-b", name: "Q2 Plan"},
        ])
      ),
    });
    const result = await discoverNotionDatabases("tkn", "Plan", {notionClient: client});
    expect(result.status).toBe("ok");
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map((c) => c.data_source_id).sort()).toEqual(["ds-a", "ds-b"]);
    expect(result.candidates.every((c) => c.id === "dbmulti")).toBe(true);
  });

  it("classifies unauthorized as token_error", async () => {
    const authErr = Object.assign(new Error("API token is invalid."), {
      code: "unauthorized", status: 401,
    });
    const client = mockClient({
      dataSources: {retrieve: jest.fn().mockRejectedValue(authErr)},
      databases: {retrieve: jest.fn().mockRejectedValue(authErr)},
      pages: {retrieve: jest.fn().mockRejectedValue(authErr)},
    });
    const result = await discoverNotionDatabases(
      "tkn", "3f2a8b1c4d5e6f708192a3b4c5d6e7f8", {notionClient: client}
    );
    expect(result.status).toBe("token_error");
  });

  it("drops branches that exceed the budget instead of failing", async () => {
    const never = new Promise(() => {});
    const client = mockClient({
      pages: {retrieve: jest.fn().mockReturnValue(never)},
      databases: {retrieve: jest.fn().mockResolvedValue(CONTAINER)},
    });
    const result = await discoverNotionDatabases(
      "tkn", "3f2a8b1c4d5e6f708192a3b4c5d6e7f8",
      {notionClient: client, budgetMs: 200}
    );
    expect(result.status).toBe("ok"); // direct branch still delivered
    expect(result.branches_completed).toContain("direct");
    expect(result.branches_completed).not.toContain("page");
  });
});
