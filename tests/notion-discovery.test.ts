import {parseNotionInput} from "../src/notion-discovery";

const ID = "3f2a8b1c4d5e6f708192a3b4c5d6e7f8";
const HYPHENATED = "3f2a8b1c-4d5e-6f70-8192-a3b4c5d6e7f8";

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
