import {Client} from "@notionhq/client";
import {removeHyphens, notionRichTextParser} from "./text";
import {getNotionError} from "./notion";
import type {DiscoveryCandidate, DiscoverySource} from "./types";
import type {DiscoveryResult} from "./types";

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

export function isNotFound(err: unknown): boolean {
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

  // When preferredDsId is provided but not found, fall back to i===0 as direct
  const foundPreferred = preferredDsId && sources.some((s) => s.id === preferredDsId);
  return sources.map((s, i) => {
    const isChosen = preferredDsId ? s.id === preferredDsId : i === 0;
    const isFallback = preferredDsId && !foundPreferred && i === 0;
    return {
      id: dbId,
      data_source_id: s.id,
      title: s.name || containerTitle,
      icon,
      url,
      breadcrumb: [],
      source: ((isChosen || isFallback) ? "direct" : "sibling_source") as DiscoverySource,
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
  let ds: {object?: string; id: string; parent?: {type?: string; database_id?: string}} | undefined;
  try {
    ds = (await notion.dataSources.retrieve({data_source_id: id})) as {
      object?: string;
      id: string;
      parent?: {type?: string; database_id?: string};
    };
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }

  if (ds?.object === "data_source") {
    const dbId = ds.parent?.type === "database_id" ? ds.parent.database_id : undefined;
    if (!dbId) return []; // externally-synced source with no container
    const container = await notion.databases.retrieve({database_id: dbId});
    return containerCandidates(container, ds.id);
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

function extractPageTitle(page: unknown): string {
  const props = (page as {properties?: Record<string, {type?: string; title?: Array<{plain_text?: string}>}>})
    .properties;
  if (!props) return "";
  const titleProp = Object.values(props).find((p) => p?.type === "title");
  return (titleProp?.title || []).map((t) => t.plain_text ?? "").join("");
}

const PAGE_CHILD_DB_CAP = 3;

export async function pageBranch(notion: Client, id: string): Promise<DiscoveryCandidate[]> {
  const page = (await notion.pages.retrieve({page_id: id})) as {
    parent?: {type?: string; data_source_id?: string; database_id?: string};
  };
  const pageTitle = extractPageTitle(page);
  const parent = page.parent;

  // Row page: the user pasted a page that lives INSIDE a database — its
  // parent is the database they want. Notion 2025-09-03 row parents are
  // {type: "data_source_id", data_source_id, database_id}.
  if (parent?.type === "data_source_id" || parent?.type === "database_id") {
    const dbId = parent.database_id;
    const dsId = parent.data_source_id;
    if (dbId) {
      const container = await notion.databases.retrieve({database_id: dbId});
      return containerCandidates(container, dsId).map((c) => ({
        ...c,
        breadcrumb: pageTitle ? [pageTitle] : [],
        source: c.source === "direct" ? ("parent_of_row" as const) : c.source,
      }));
    }
    return [];
  }

  // Plain page: one level of children only — discovery must stay fast, unlike
  // the exhaustive findNotionInlineDatabases used post-OAuth.
  const children = (await notion.blocks.children.list({block_id: id, page_size: 100})) as {
    results: Array<{type?: string; id: string}>;
  };
  const childDbs = children.results
    .filter((b) => b.type === "child_database")
    .slice(0, PAGE_CHILD_DB_CAP);

  const out: DiscoveryCandidate[] = [];
  for (const block of childDbs) {
    try {
      const container = await notion.databases.retrieve({database_id: block.id});
      out.push(
        ...containerCandidates(container).map((c) => ({
          ...c,
          breadcrumb: pageTitle ? [pageTitle] : [],
          source: c.source === "direct" ? ("found_in_link" as const) : c.source,
        }))
      );
    } catch (err) {
      if (!isNotFound(err)) throw err; // skip unreadable child, keep the rest
    }
  }
  return out;
}

const DEFAULT_BUDGET_MS = 4000;
const SEARCH_LIMIT = 5;

function withBudget<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Object.assign(new Error("discovery_budget_exceeded"), {budget: true})),
      ms
    );
    (timer as {unref?: () => void}).unref?.();
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

/** v5 raw search → candidates. Mirrors NotionAPI().search mapping. */
async function searchBranch(notion: Client, text: string): Promise<DiscoveryCandidate[]> {
  if (!text) return [];
  const raw = (await notion.search({
    query: text,
    filter: {value: "data_source", property: "object"},
    sort: {direction: "descending", timestamp: "last_edited_time"},
    page_size: SEARCH_LIMIT,
  })) as {results: Array<Record<string, unknown>>};

  const out: DiscoveryCandidate[] = [];
  const seenDb = new Set<string>();
  for (const item of raw.results) {
    const it = item as {
      object?: string; id: string;
      parent?: {type?: string; database_id?: string};
      title?: Array<{plain_text?: string}>;
    };
    if (it.object !== "data_source" || it.parent?.type !== "database_id" || !it.parent.database_id)
      continue;
    const dbId = removeHyphens(it.parent.database_id);
    if (seenDb.has(dbId)) continue;
    seenDb.add(dbId);
    out.push({
      id: dbId,
      data_source_id: it.id,
      title: (it.title || []).map((t) => t.plain_text ?? "").join("") || "Untitled",
      icon: null,
      url: `https://www.notion.so/${dbId}`,
      breadcrumb: [],
      source: "workspace_search",
    });
  }
  return out;
}

export async function discoverNotionDatabases(
  accessToken: string,
  rawInput: string,
  opts?: {budgetMs?: number; notionClient?: Client}
): Promise<DiscoveryResult> {
  const start = Date.now();
  const budgetMs = opts?.budgetMs ?? DEFAULT_BUDGET_MS;
  const parsed = parseNotionInput(rawInput);

  const base: Omit<DiscoveryResult, "status"> = {
    input_kind: parsed.kind,
    candidates: [],
    branches_completed: [],
    duration_ms: 0,
  };
  if (parsed.kind === "empty") {
    return {...base, status: "nothing_found", duration_ms: Date.now() - start};
  }

  const notion =
    opts?.notionClient ??
    new Client({auth: accessToken, notionVersion: "2025-09-03", timeoutMs: 10000});

  const branches: Array<{name: string; run: Promise<DiscoveryCandidate[]>}> = [];
  if (parsed.kind === "id") {
    branches.push({name: "direct", run: directBranch(notion, parsed.id)});
    branches.push({name: "page", run: pageBranch(notion, parsed.id)});
    if (parsed.slugText) branches.push({name: "search", run: searchBranch(notion, parsed.slugText)});
  } else {
    branches.push({name: "search", run: searchBranch(notion, parsed.text)});
  }

  const settled = await Promise.allSettled(branches.map((b) => withBudget(b.run, budgetMs)));

  const lists: DiscoveryCandidate[][] = [];
  const completed: string[] = [];
  let sawTokenError = false;
  let idNotFound = 0;
  let idBranchCount = 0;

  settled.forEach((s, i) => {
    const name = branches[i].name;
    const isIdBranch = name === "direct" || name === "page";
    if (isIdBranch) idBranchCount++;
    if (s.status === "fulfilled") {
      completed.push(name);
      lists.push(s.value);
    } else {
      const err = s.reason as {budget?: boolean; code?: string; status?: number};
      if (err?.budget) return; // budget drop — silent by design
      const notionErr = getNotionError(s.reason);
      const isTknError = notionErr?.isTknError || err?.code === "unauthorized" || err?.status === 401;
      if (isTknError) sawTokenError = true;
      else if (isIdBranch && isNotFound(s.reason)) idNotFound++;
      // Everything else (rate limit, server error): drop the branch silently.
    }
  });

  const candidates = mergeCandidates(lists);
  const duration_ms = Date.now() - start;

  let status: DiscoveryResult["status"];
  if (sawTokenError && candidates.length === 0) status = "token_error";
  else if (candidates.length > 0) status = "ok";
  else if (parsed.kind === "id" && parsed.fromUrl && idNotFound === idBranchCount && idBranchCount > 0)
    status = "no_access";
  else status = "nothing_found";

  return {...base, status, candidates, branches_completed: completed, duration_ms};
}
