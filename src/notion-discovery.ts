import type {Client} from "@notionhq/client";
import {removeHyphens, notionRichTextParser} from "./text";
import type {DiscoveryCandidate, DiscoverySource} from "./types";

export type NotionInputParse =
  | {kind: "id"; id: string; fromUrl: boolean; slugText?: string}
  | {kind: "text"; text: string}
  | {kind: "empty"};

// 32 hex chars, optionally hyphenated 8-4-4-4-12; must not be followed by
// another hex char (avoids matching inside longer strings).
const NOTION_ID_RE =
  /([a-f0-9]{8})-?([a-f0-9]{4})-?([a-f0-9]{4})-?([a-f0-9]{4})-?([a-f0-9]{12})(?![a-f0-9])/i;

function canonId(m: RegExpMatchArray): string {
  return (m[1] + m[2] + m[3] + m[4] + m[5]).toLowerCase();
}

/** Last non-empty path segment minus the trailing id, hyphens → spaces. */
function slugFromPath(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean).pop() || "";
  const withoutId = seg.replace(NOTION_ID_RE, "");
  return withoutId.replace(/-+/g, " ").trim();
}

export function parseNotionInput(raw: string): NotionInputParse {
  const input = (raw || "").trim();
  if (!input) return {kind: "empty"};

  const isUrl = /^https?:\/\//i.test(input);
  if (isUrl) {
    let url: URL | undefined;
    try {
      url = new URL(input);
    } catch {
      url = undefined;
    }
    const pathname = url?.pathname ?? input;
    const slugText = slugFromPath(pathname);

    // ?p= is the "peek" page id — the page actually open in the side panel.
    // Prefer it: the path id behind it is the collection, but the user is
    // looking at (and means) the peeked page.
    const peek = url?.searchParams.get("p") || "";
    const peekMatch = peek.match(NOTION_ID_RE);
    if (peekMatch) {
      return {kind: "id", id: canonId(peekMatch), fromUrl: true, ...(slugText && {slugText})};
    }

    // ?v= is a view id on the same database — the path id already identifies
    // the database, so the view param is simply ignored.
    const pathMatch = pathname.match(NOTION_ID_RE);
    if (pathMatch) {
      return {kind: "id", id: canonId(pathMatch), fromUrl: true, ...(slugText && {slugText})};
    }

    return slugText ? {kind: "text", text: slugText} : {kind: "empty"};
  }

  const m = input.match(NOTION_ID_RE);
  if (m) return {kind: "id", id: canonId(m), fromUrl: false};
  return {kind: "text", text: input};
}

function isNotFound(err: unknown): boolean {
  const e = err as {code?: string; status?: number};
  return e?.code === "object_not_found" || e?.status === 404;
}

type ContainerShape = {
  id: string;
  url?: string;
  icon?: {type?: string; emoji?: string; external?: {url?: string}} | null;
  title?: Array<{plain_text?: string}>;
  data_sources?: Array<{id: string; name?: string}>;
};

export function containerCandidates(
  container: unknown,
  preferredDsId?: string
): DiscoveryCandidate[] {
  const c = container as ContainerShape;
  const dbId = removeHyphens(c.id);
  const containerTitle = notionRichTextParser(c.title as never) || "Untitled";
  const icon =
    c.icon?.type === "emoji" ? c.icon.emoji ?? null : c.icon?.external?.url ?? null;
  const url = c.url || `https://www.notion.so/${dbId}`;
  const sources = c.data_sources ?? [];

  return sources.map((s, i) => {
    const isChosen = preferredDsId ? s.id === preferredDsId : i === 0;
    return {
      id: dbId,
      data_source_id: s.id,
      title: s.name || containerTitle,
      icon,
      url,
      breadcrumb: [],
      source: (isChosen ? "direct" : "sibling_source") as DiscoverySource,
    };
  });
}

/**
 * Try `id` as a data_source_id, then as a database (container) id.
 * Returns every data source of the resolved container. Throws Notion errors
 * upward (except the internal data_source→database 404 fallback) so the
 * orchestrator can classify token errors and no-access.
 */
export async function directBranch(notion: Client, id: string): Promise<DiscoveryCandidate[]> {
  try {
    const ds = (await notion.dataSources.retrieve({data_source_id: id})) as {
      object?: string;
      id: string;
      parent?: {type?: string; database_id?: string};
    };
    if (ds?.object === "data_source") {
      const dbId = ds.parent?.type === "database_id" ? ds.parent.database_id : undefined;
      if (!dbId) return []; // externally-synced source with no container
      const container = await notion.databases.retrieve({database_id: dbId});
      return containerCandidates(container, ds.id);
    }
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }
  const container = await notion.databases.retrieve({database_id: id});
  return containerCandidates(container);
}

const SOURCE_RANK: Record<DiscoverySource, number> = {
  direct: 0,
  found_in_link: 1,
  parent_of_row: 2,
  sibling_source: 3,
  workspace_search: 4,
};

export function mergeCandidates(lists: DiscoveryCandidate[][]): DiscoveryCandidate[] {
  const byDs = new Map<string, DiscoveryCandidate>();
  for (const c of lists.flat()) {
    const existing = byDs.get(c.data_source_id);
    if (!existing || SOURCE_RANK[c.source] < SOURCE_RANK[existing.source]) {
      byDs.set(c.data_source_id, c);
    }
  }
  return [...byDs.values()].sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source]);
}
