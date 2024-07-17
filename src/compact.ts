import {dashifyNotionId} from "./text";

function createBlockMetadata(unofficialBlock: any) {
  return {
    object: "block",
    id: unofficialBlock.id,
    parent: {
      type: "page_id",
      page_id: unofficialBlock.parent_id,
    },
    created_time: new Date(unofficialBlock.created_time).toISOString(),
    last_edited_time: new Date(unofficialBlock.last_edited_time).toISOString(),
    created_by: {
      object: "user",
      id: unofficialBlock.created_by_id,
    },
    last_edited_by: {
      object: "user",
      id: unofficialBlock.last_edited_by_id,
    },
    has_children: false,
    archived: !unofficialBlock.alive,
  };
}

function mapRichText(richText): any[] {
  if (!richText) return [];
  return richText.map(([content, formatting]) => {
    const annotations = {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default",
    };

    let link = null;
    let href = null;

    if (formatting) {
      formatting.forEach(([format, value]) => {
        switch (format) {
          case "b":
            annotations.bold = true;
            break;
          case "i":
            annotations.italic = true;
            break;
          case "_":
            annotations.underline = true;
            break;
          case "c":
            annotations.code = true;
            break;
          case "h":
            annotations.color = "default";
            break;
          case "a":
            link = {url: value};
            href = value;
            break;
        }
      });
    }

    return {
      type: "text",
      text: {
        content: content as string,
        link,
      },
      annotations,
      plain_text: content as string,
      href,
    };
  });
}
export const defaultMapImageUrl = (url: string, block): string | null => {
  if (!url) {
    return null;
  }

  if (url.startsWith("data:")) {
    return url;
  }

  // more recent versions of notion don't proxy unsplash images
  if (url.startsWith("https://images.unsplash.com")) {
    return url;
  }

  try {
    const u = new URL(url);

    if (
      u.pathname.startsWith("/secure.notion-static.com") &&
      u.hostname.endsWith(".amazonaws.com")
    ) {
      if (
        u.searchParams.has("X-Amz-Credential") &&
        u.searchParams.has("X-Amz-Signature") &&
        u.searchParams.has("X-Amz-Algorithm")
      ) {
        // if the URL is already signed, then use it as-is
        return url;
      }
    }
  } catch {
    return url;
  }

  if (url.startsWith("/images")) {
    url = `https://www.notion.so${url}`;
  }

  url = `https://www.notion.so${
    url.startsWith("/image") ? url : `/image/${encodeURIComponent(url)}`
  }`;

  const notionImageUrlV2 = new URL(url);
  let table = block.parent_table === "space" ? "block" : block.parent_table;
  if (table === "collection" || table === "team") {
    table = "block";
  }
  notionImageUrlV2.searchParams.set("table", table);
  notionImageUrlV2.searchParams.set("id", block.id);
  notionImageUrlV2.searchParams.set("cache", "v2");

  url = notionImageUrlV2.toString();

  return url;
};

// Convert Unofficial API RichText Block to Official API Rich Text Block
function convertRecordMapRichTextToNotionApiBlock(unofficialBlock) {
  return {
    ...createBlockMetadata(unofficialBlock),
    type: "paragraph",
    paragraph: {
      rich_text: mapRichText(unofficialBlock?.properties?.title),
      color: "default",
    },
  };
}

function convertRecordMapImageToNotionApiBlock(unofficialBlock) {
  return {
    ...createBlockMetadata(unofficialBlock),
    type: "image",
    image: {
      caption: unofficialBlock.properties?.caption
        ? mapRichText(unofficialBlock.properties?.caption)
        : [],
      type: "file",
      file: {
        url: defaultMapImageUrl(
          unofficialBlock.properties.source[0][0] as string,
          unofficialBlock
        ),
        expiry_time: null, // 1 hour from now
      },
    },
  };
}
function convertRecordMapVideoToNotionApiBlock(unofficialBlock) {
  return {
    ...createBlockMetadata(unofficialBlock),
    type: "video",
    video: {
      caption: unofficialBlock.properties?.caption ? unofficialBlock.properties.caption : [],
      type: "file",
      file: {
        url: defaultMapImageUrl(unofficialBlock.properties.source[0][0], unofficialBlock),
        expiry_time: new Date().toISOString(),
      },
    },
  };
}
function convertRecordMapDividerToNotionApiBlock(unofficialBlock) {
  return {
    ...createBlockMetadata(unofficialBlock),
    type: "divider",
    divider: {},
  };
}
function convertRecordMapBulletListToNotionApiBlock(unofficialBlock) {
  return {
    ...createBlockMetadata(unofficialBlock),
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: mapRichText(unofficialBlock?.properties?.title),
      color: "default",
    },
  };
}
function convertRecordMapToDoToNotionApiBlock(unofficialBlock) {
  return {
    ...createBlockMetadata(unofficialBlock),
    type: "to_do",
    to_do: {
      rich_text: mapRichText(unofficialBlock?.properties?.title),
      checked: unofficialBlock.properties?.checked?.[0]?.[0] === "Yes",
      color: "default",
    },
  };
}
function convertRecordMapEmbedToNotionApiBlock(unofficialBlock) {
  return {
    ...createBlockMetadata(unofficialBlock),
    type: "embed",
    embed: {
      caption: [],
      url: unofficialBlock.properties.source[0][0],
    },
  };
}
function convertRecordMapBookmarkToNotionApiBlock(unofficialBlock) {
  return {
    ...createBlockMetadata(unofficialBlock),
    type: "bookmark",
    bookmark: {
      caption: mapRichText(unofficialBlock.properties.caption),
      url: unofficialBlock.properties.link[0][0],
    },
  };
}

export function mapRawContentIdsToBlocks(rawPageBlocks: any, contentIds) {
  const blocks = [];

  contentIds.forEach((contentId: string) => {
    const block = rawPageBlocks[dashifyNotionId(contentId)];
    blocks.push(block?.value);
  });

  return blocks;
}
export function convertUnofficialBlocksToOfficialFormat(unOffBlocks) {
  const offblocks = [];
  unOffBlocks.forEach((unOffBlock) => {
    let block;
    switch (unOffBlock.type) {
      case "text":
        block = convertRecordMapRichTextToNotionApiBlock(unOffBlock);
        break;
      case "image":
        block = convertRecordMapImageToNotionApiBlock(unOffBlock);
        break;
      case "video":
        block = convertRecordMapVideoToNotionApiBlock(unOffBlock);
        break;
      case "divider":
        block = convertRecordMapDividerToNotionApiBlock(unOffBlock);
        break;
      case "bulleted_list":
        block = convertRecordMapBulletListToNotionApiBlock(unOffBlock);
        break;
      case "to_do":
        block = convertRecordMapToDoToNotionApiBlock(unOffBlock);
        break;
      case "tweet":
        block = convertRecordMapEmbedToNotionApiBlock(unOffBlock);
        break;
      case "embed":
        block = convertRecordMapEmbedToNotionApiBlock(unOffBlock);
        break;
      case "bookmark":
        block = convertRecordMapBookmarkToNotionApiBlock(unOffBlock);
        break;
      default:
        break;
    }
    if (block) offblocks.push(block);
  });
  return offblocks;
}
