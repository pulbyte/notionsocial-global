import {parseNotionInput, containerCandidates, directBranch, mergeCandidates} from "../src/notion-discovery";
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
