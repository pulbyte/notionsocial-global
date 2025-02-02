import {NotionCodedTextPayload, NotionRichTextPayload, NotionRule} from "./types";
import {hasText, notionRichTextParser} from "./text";

export function getNotionPropertyMatchVal(property) {
  if (property.type == "checkbox") {
    return property[property.type];
  } else if (property.type == "rich_text") {
    return notionRichTextParser(property[property.type]);
  } else if (property.type == "select") {
    return String(property[property.type]?.["name"]).trim();
  } else if (property.type == "multi_select") {
    return property[property.type]?.map((select) => String(select.name)?.trim());
  } else return null;
}

export function parseNotionRule(filterStr: string, properties): boolean {
  if (!filterStr || filterStr == null) return null;
  else if (filterStr == "true") return true;
  else if (filterStr == "false") return false;
  else {
    const filter: NotionRule = JSON.parse(filterStr);
    const propertyName = filter["property"];
    const property = properties[propertyName];
    // ** When a rule property is deleted from the database
    if (!property) return false;
    const rule: "contains" | "equals" = filter.rule;
    const matchVal = getNotionPropertyMatchVal(property);
    if (
      matchVal &&
      rule == "contains" &&
      ["rich_text", "multi_select"].includes(filter.type) &&
      (typeof matchVal == "string" || typeof matchVal == "object")
    ) {
      return matchVal.includes(filter.match);
    } else if (matchVal && rule == "equals") {
      switch (typeof matchVal) {
        case "string":
          return matchVal == filter.match;
        case "boolean":
          return String(matchVal) == String(filter.match);
        case "object":
          return matchVal.length == 1 && matchVal[0] == filter.match;
        default:
          return false;
      }
    } else return false;
  }
}

export function createCodedRichText(texts: NotionCodedTextPayload[]) {
  const richText: NotionRichTextPayload[] = [];

  texts.forEach((payload, index) => {
    const {text, color, br, sp, ul, code, bold} = payload;
    const nextText = texts[index + 1];
    const isLast = index === texts.length - 1;
    const hasNext = hasText(nextText?.text) && !isLast;

    // Regular expression to match URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    // Split the text by URLs
    const parts = text.split(urlRegex);

    const annotations = {
      bold: Object.keys(payload).includes("bold") ? bold : true,
      color: color || "default",
      code: Object.keys(payload).includes("code") ? code : true,
      underline: ul,
    };

    parts.forEach((part, partIndex) => {
      if (urlRegex.test(part)) {
        // This part is a URL
        richText.push({
          text: {
            content: part,
            link: {url: part},
          },
          annotations,
        });
      } else if (part.length > 0) {
        // This part is regular text
        richText.push({
          text: {content: part},
          annotations,
        });
      }
    });

    if (sp && hasNext) richText.push({text: {content: " "}});
    if (br && hasNext) richText.push({text: {content: "\n"}});
  });

  return {
    type: "rich_text",
    rich_text: richText,
  };
}
