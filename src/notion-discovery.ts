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
