import http from "node:http";
import type {AddressInfo} from "node:net";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {getContentFromNotionBlocksAsync} from "../content";
import type {NotionBlock} from "../types";

const user = {object: "user", id: "u1"} as const;

const embed = (url: string): NotionBlock => ({
  object: "block",
  id: "b1",
  parent: {type: "page_id", page_id: "p1"},
  created_time: "",
  created_by: user,
  last_edited_time: "",
  last_edited_by: user,
  has_children: false,
  archived: false,
  in_trash: false,
  type: "embed",
  embed: {url, caption: []},
});

// A local file host: /a.png is an image, anything else a web page.
function fileHost(req: http.IncomingMessage, res: http.ServerResponse) {
  const png = req.url === "/a.png";

  res.writeHead(200, {"content-type": png ? "image/png" : "text/html", "content-length": "4"});
  res.end("abcd");
}

// #65: an embed block whose URL is a file is posted as media; other embeds stay URL text.
describe("embed blocks as media", () => {
  let server: http.Server;
  let base = "";

  beforeAll(async () => {
    server = http.createServer(fileHost);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    // SAFETY: a server listening on a TCP port reports an AddressInfo.
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it("posts the file an embed links to, with the switch on", async () => {
    const {richText} = await getContentFromNotionBlocksAsync([embed(`${base}/a.png`)], {mediaLinks: true});
    const media = richText.paragraphs.flatMap((p) => p.media);
    expect(media).toHaveLength(1);
    expect(media[0]).toMatchObject({type: "image", contentType: "image/png"});
    expect(richText.text).not.toContain(base);
  });

  it("keeps the URL as text when the switch is off or the link is a web page", async () => {
    for (const [block, options] of [
      [embed(`${base}/a.png`), {}],
      [embed(`${base}/page`), {mediaLinks: true}],
    ] as const) {
      const {richText} = await getContentFromNotionBlocksAsync([block], options);
      expect(richText.paragraphs.flatMap((p) => p.media)).toHaveLength(0);
    }
  });
});
