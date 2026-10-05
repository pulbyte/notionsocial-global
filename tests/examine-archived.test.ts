import {examinePostConfig} from "../src/_publish";

const base: any = {status: "Done", nsFilter: "Done", smAccs: [{platform_uid: "1"}], _props: {}, _pageId: "p1"};

test("a page in the Notion trash is rejected as notion-page-deleted", async () => {
  await expect(examinePostConfig({...base, archived: true})).rejects.toMatchObject({code: "notion-page-deleted"});
});

test("a live page still passes", async () => {
  await expect(examinePostConfig({...base, archived: false})).resolves.toBeTruthy();
});
