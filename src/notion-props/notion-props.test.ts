import {expect, test} from "vitest";
import {healProps, statusFilterType} from "./index";

const schema = {
  Text: {id: "cap1", type: "rich_text"},
  When: {id: "time1", type: "date"},
  Status: {id: "st1", type: "status"},
};

test("a renamed property is followed by id; types are refreshed", () => {
  const h = healProps({caption: "Caption", sch_time: "When", status: "Status"}, {caption: {id: "cap1", type: "rich_text"}}, schema);

  expect(h.props).toEqual({caption: "Text", sch_time: "When", status: "Status"});
  expect(h.renamed).toEqual([{role: "caption", from: "Caption", to: "Text"}]);
  expect(h.missing).toEqual([]);
  expect(h.meta.status).toEqual({id: "st1", type: "status"});
  expect(h.changed).toBe(true);
});

test("a deleted property is reported missing; nothing else changes", () => {
  const h = healProps({caption: "Gone", sch_time: "When"}, {caption: {id: "nope", type: "rich_text"}, sch_time: {id: "time1", type: "date"}}, schema);

  expect(h.missing).toEqual(["caption"]);
  expect(h.props.caption).toBe("Gone");
});

test("unchanged names and meta report no change", () => {
  const meta = {sch_time: {id: "time1", type: "date"}};

  expect(healProps({sch_time: "When"}, meta, schema).changed).toBe(false);
});

test("native Status uses the status filter, anything else select", () => {
  expect(statusFilterType({status: {id: "s", type: "status"}})).toBe("status");
  expect(statusFilterType({status: {id: "s", type: "select"}})).toBe("select");
  expect(statusFilterType(undefined)).toBe("select");
});
