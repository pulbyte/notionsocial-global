import {describe, expect, it} from "vitest";
import {explain} from "../platform-spec";
import type {Media, ProcessedMediaRecord} from "../types";
import {MediaLinkError, mediaFromLink, pageRef, withPdfPages, type HttpAnswer, type LinkDeps} from "./index";

type Fake = {name: string};

const ok = (body: string, url = ""): HttpAnswer => ({status: 200, body, url});

// A GET that answers from a table by URL prefix; anything else is a 404.
function deps(routes: Record<string, HttpAnswer>, files: Record<string, string>, driveApiKey?: string): LinkDeps<Fake> {
  return {
    get: async (url) => Object.entries(routes).find(([prefix]) => url.startsWith(prefix))?.[1] ?? {status: 404, body: "", url},
    fromUrl: async (url) => (files[url] ? {name: files[url]} : null),
    driveApiKey,
  };
}

const driveFile = (id: string) => `https://drive.google.com/file/d/${id}/view`;

// Synthetic copy of Drive's embedded folder page (ids made up).
const folderPage = [
  ["f2", "image/png", "10.png"],
  ["f1", "image/jpeg", "2.jpg"],
  ["t1", "text/plain", "notes.txt"],
]
  .map(([id, type, name]) => `<div class="flip-entry" id="entry-${id}"><div class="flip-entry-info"><a href="https://drive.google.com/file/d/${id}/view?usp=drive_web" target="_blank"><div class="flip-entry-list-icon"><img src="https://drive-thirdparty.googleusercontent.com/16/type/${type}" alt=""/></div><div class="flip-entry-title">${name}</div></a></div></div>`)
  .join("");

const catalogue = async (run: Promise<unknown>, code: "drive-restricted" | "canva-link") => {
  const error = await run.catch((e: MediaLinkError) => e);

  expect(error).toBeInstanceOf(MediaLinkError);
  expect(error).toMatchObject({errorCode: code, message: explain(code).message});
};

describe("Drive folder links", () => {
  const folder = "https://drive.google.com/drive/folders/FOLDER1?usp=sharing";
  const files = {[driveFile("f1")]: "2.jpg", [driveFile("f2")]: "10.png"};

  it("posts a public folder's images in name order, through the Drive API when a key is set", async () => {
    const list = JSON.stringify({files: [{id: "f2", name: "10.png", mimeType: "image/png"}, {id: "f1", name: "2.jpg", mimeType: "image/jpeg"}, {id: "t1", name: "a.txt", mimeType: "text/plain"}]});

    const routes = {"https://www.googleapis.com/drive/v3/files/FOLDER1?": ok("{}"), "https://www.googleapis.com/drive/v3/files?q=": ok(list)};

    expect(await mediaFromLink(folder, deps(routes, files, "KEY"))).toEqual([{name: "2.jpg"}, {name: "10.png"}]);
  });

  it("reads the embedded folder page when no key is set", async () => {
    expect(await mediaFromLink(folder, deps({"https://drive.google.com/embeddedfolderview?id=FOLDER1": ok(folderPage)}, files))).toEqual([{name: "2.jpg"}, {name: "10.png"}]);
  });

  it("fails a private folder with the catalogue error", async () => {
    await catalogue(mediaFromLink(folder, deps({}, files)), "drive-restricted");
    await catalogue(mediaFromLink(folder, deps({"https://drive.google.com/embeddedfolderview": ok("", "https://accounts.google.com/signin")}, files)), "drive-restricted");
  });

  it("fails a private folder through the Drive API, which lists it as empty", async () => {
    await catalogue(mediaFromLink(folder, deps({"https://www.googleapis.com/drive/v3/files?q=": ok(JSON.stringify({files: []}))}, files, "KEY")), "drive-restricted");
  });

  it("fails a folder holding a private file", async () => {
    await catalogue(mediaFromLink(folder, deps({"https://drive.google.com/embeddedfolderview": ok(folderPage)}, {})), "drive-restricted");
  });
});

describe("file links", () => {
  it("fails a restricted Drive file with the catalogue error", async () => {
    await catalogue(mediaFromLink(driveFile("private1"), deps({}, {})), "drive-restricted");
  });

  it("keeps a public Drive file and drops other links that give no file, as before", async () => {
    expect(await mediaFromLink(driveFile("f1"), deps({}, {[driveFile("f1")]: "a.jpg"}))).toEqual([{name: "a.jpg"}]);
    expect(await mediaFromLink("https://x.com/a/status/1", deps({}, {}))).toEqual([]);
  });
});

describe("Canva links", () => {
  const view = "https://www.canva.com/design/DAG1/TOKEN1/view";
  const oembed = `https://www.canva.com/_oembed?url=${encodeURIComponent(view)}`;
  const image = "https://www.canva.com/design/DAG1/TOKEN1/screen";
  const embed = ok(JSON.stringify({type: "rich", thumbnail_url: `${image}?type=thumbnail`}));

  it("posts a public design's image, from a share link or a canva.link short link", async () => {
    const d = deps({[oembed]: embed, "https://canva.link/abc": ok("", `${view}?utm_source=share`)}, {[image]: "design.png"});

    expect(await mediaFromLink("https://www.canva.com/design/DAG1/TOKEN1/view?utm_content=x", d)).toEqual([{name: "design.png"}]);
    expect(await mediaFromLink("https://canva.link/abc", d)).toEqual([{name: "design.png"}]);
  });

  it("fails a design that is not public, or whose image Canva refuses, with the catalogue error", async () => {
    await catalogue(mediaFromLink("https://www.canva.com/design/DAG1/TOKEN1/edit", deps({[oembed]: {status: 401, body: "", url: oembed}}, {})), "canva-link");
    await catalogue(mediaFromLink(view, deps({[oembed]: embed}, {})), "canva-link");
    await catalogue(mediaFromLink("https://www.canva.com/templates/", deps({}, {})), "canva-link");
  });
});

describe("PDF pages", () => {
  const pdf: Media = {name: "deck.pdf", url: "https://s3/deck.pdf", mimeType: "pdf", contentType: "application/pdf", size: 9, type: "doc", refId: "ref_deck.pdf"};

  const img: Media = {...pdf, name: "a.jpg", mimeType: "jpeg", contentType: "image/jpeg", type: "image", refId: "ref_a.jpg"};

  const page = (n: number): ProcessedMediaRecord => ({
    ref_id: pageRef(pdf.refId, n),
    processed_at: 1,
    transformations: [
      {platforms: ["instagram"], method: "sharp", compression: "lossy", metadata: {size: 100 + n, width: 1080, height: 1350}, src: {type: "bucket", path: `${pageRef(pdf.refId, n)}/lossy/1080x1350`}},
      {platforms: [], method: "sharp", compression: "lossy", metadata: {size: 200 + n, width: 1080, height: 1527}, src: {type: "bucket", path: `${pageRef(pdf.refId, n)}/lossy/1080x1527`}},
    ],
  });

  it("puts a 5-page PDF's stored pages after it, in page order", () => {
    const out = withPdfPages([img, pdf], [5, 3, 1, 4, 2].map(page), "bucket1");

    expect(out.map((m) => m.refId)).toEqual(["ref_a.jpg", "ref_deck.pdf", ...[1, 2, 3, 4, 5].map((n) => `ref_deck.pdf~p${n}`)]);
    expect(out[2]).toEqual({name: "deck-1.jpg", url: "https://storage.googleapis.com/bucket1/ref_deck.pdf~p1/lossy/1080x1527", mimeType: "jpeg", contentType: "image/jpeg", size: 201, type: "image", refId: "ref_deck.pdf~p1", pageOf: "ref_deck.pdf"});
  });

  it("leaves media unchanged until post-process has stored pages", () => {
    expect(withPdfPages([img, pdf], undefined, "b")).toEqual([img, pdf]);
    expect(withPdfPages([img, pdf], [{...page(1), ref_id: "ref_other.pdf~p1"}], "b")).toEqual([img, pdf]);
  });
});
