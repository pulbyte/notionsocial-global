// Update the existing convertHtmlToNotionApiRichText function to handle image blocks
export function convertHtmlToNotionApiBlocks(elements: NodeListOf<ChildNode>): any[] {
  const blocks = [];

  for (const node of elements) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.classList.contains("notion-image-block")) {
        const imageBlock = convertHtmlImageToNotionApiBlock(element);
        if (imageBlock) {
          blocks.push(imageBlock);
        }
      } else if (element.classList.contains("notion-video-block")) {
        const videoBlock = convertHtmlVideoToNotionApiBlock(element);
        if (videoBlock) {
          blocks.push(videoBlock);
        }
      } else if (element.classList.contains("notion-divider-block")) {
        blocks.push(convertHtmlDividerToNotionApiBlock(element));
      } else if (element.classList.contains("notion-text-block")) {
        const richTextBlock = {
          type: "paragraph",
          paragraph: {
            rich_text: convertHtmlToNotionApiRichText(element.outerHTML),
          },
        };
        blocks.push(richTextBlock);
      } else if (element.classList.contains("notion-bulleted_list-block")) {
        blocks.push(convertHtmlBulletedListToNotionApiBlock(element));
      } else if (element.classList.contains("notion-numbered_list-block")) {
        blocks.push(convertHtmlNumberedListToNotionApiBlock(element));
      } else if (element.classList.contains("notion-to_do-block")) {
        blocks.push(convertHtmlToDoToNotionApiBlock(element));
      } else if (element.classList.contains("notion-tweet-block")) {
        blocks.push(convertHtmlTweetEmbedToNotionApiBlock(element));
      } else if (element.classList.contains("notion-bookmark-block")) {
        blocks.push(convertHtmlBookmarkToNotionApiBlock(element));
      }
    }
  }

  return blocks;
}
/* -------------------------------------------------------------------------- */
/*                                  Rich Text                               */
/* -------------------------------------------------------------------------- */
function convertHtmlToNotionApiRichText(html: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const contentDiv = doc.querySelector('[data-content-editable-leaf="true"]');

  if (!contentDiv) {
    return [];
  }

  const richTextItems = [];
  const childNodes = contentDiv.childNodes;

  for (const node of childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      richTextItems.push(createRichTextItem(node.textContent || "", false, false));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const isBold = element.style.fontWeight === "600";
      const isItalic = element.style.fontStyle === "italic";
      const isLink = element.tagName.toLowerCase() === "a";

      if (isLink) {
        const href = element.getAttribute("href") || "";
        richTextItems.push(
          createRichTextItem(element.textContent || "", isBold, isItalic, href)
        );
      } else if (element.classList.contains("notion-emoji")) {
        const emoji = element.getAttribute("alt") || "";
        richTextItems.push(createRichTextItem(emoji, false, false));
      } else {
        richTextItems.push(createRichTextItem(element.textContent || "", isBold, isItalic));
      }
    }
  }

  return richTextItems;
}

function createRichTextItem(
  content: string,
  isBold: boolean,
  isItalic: boolean,
  href?: string
) {
  return {
    type: "text",
    text: {
      content: content,
      link: href,
    },
    annotations: {
      bold: isBold,
      italic: isItalic,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default",
    },
    plain_text: content,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Image Block                                */
/* -------------------------------------------------------------------------- */
function convertHtmlImageToNotionApiBlock(imageElement: HTMLElement): any {
  const imgElement = imageElement.querySelector("img");

  const captionElement = imageElement.querySelector('[data-content-editable-leaf="true"]');

  if (!imgElement) {
    return null;
  }
  const imageUrl = imgElement.src;
  const caption = captionElement
    ? convertHtmlToNotionApiRichText(captionElement.outerHTML)
    : [];

  return {
    type: "image",
    image: {
      type: "file",
      file: {
        url: imageUrl,
      },
      caption: caption,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Video Block                                */
/* -------------------------------------------------------------------------- */
function convertHtmlVideoToNotionApiBlock(videoElement: HTMLElement): any {
  const videoSrc = videoElement.querySelector("video")?.getAttribute("src") || "";
  const captionElement = videoElement.querySelector('[data-content-editable-leaf="true"]');
  return {
    type: "video",
    video: {
      type: "file",
      file: {
        url: videoSrc,
      },
      caption: captionElement ? convertHtmlToNotionApiRichText(captionElement.outerHTML) : [],
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Divider Block                                */
/* -------------------------------------------------------------------------- */
function convertHtmlDividerToNotionApiBlock(dividerElement: HTMLElement): any {
  return {
    type: "divider",
    divider: {},
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Bulleted List Block                                */
/* -------------------------------------------------------------------------- */
function convertHtmlBulletedListToNotionApiBlock(listElement: HTMLElement): any {
  const contentElement = listElement.querySelector('[data-content-editable-leaf="true"]');

  return {
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: contentElement
        ? convertHtmlToNotionApiRichText(contentElement.outerHTML)
        : [],
      color: "default",
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Numbered List Block                                */
/* -------------------------------------------------------------------------- */
function convertHtmlNumberedListToNotionApiBlock(listElement: HTMLElement): any {
  const contentElement = listElement.querySelector('[data-content-editable-leaf="true"]');

  return {
    type: "numbered_list_item",
    numbered_list_item: {
      rich_text: contentElement
        ? convertHtmlToNotionApiRichText(contentElement.outerHTML)
        : [],
      color: "default",
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                  To-Do Block                                */
/* -------------------------------------------------------------------------- */
function convertHtmlToDoToNotionApiBlock(todoElement: HTMLElement): any {
  const contentElement = todoElement.querySelector('[data-content-editable-leaf="true"]');
  const checkboxElement = todoElement.querySelector('input[type="checkbox"]');

  return {
    type: "to_do",
    to_do: {
      rich_text: contentElement
        ? convertHtmlToNotionApiRichText(contentElement.outerHTML)
        : [],
      checked: checkboxElement ? (checkboxElement as HTMLInputElement).checked : false,
      color: "default",
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Tweet Embed Block                                */
/* -------------------------------------------------------------------------- */
function convertHtmlTweetEmbedToNotionApiBlock(tweetElement: HTMLElement): any {
  const iframeElement = tweetElement.querySelector("iframe");
  const tweetUrl = iframeElement?.getAttribute("data-tweet-id")
    ? `https://twitter.com/i/web/status/${iframeElement.getAttribute("data-tweet-id")}`
    : "";

  return {
    type: "embed",
    embed: {
      url: tweetUrl,
      caption: [],
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Bookmark Block                                */
/* -------------------------------------------------------------------------- */
function convertHtmlBookmarkToNotionApiBlock(bookmarkElement: HTMLElement): any {
  const linkElement = bookmarkElement.querySelector("a");
  const titleElement = bookmarkElement.querySelector('div[style*="font-size: 14px"]');
  const descriptionElement = bookmarkElement.querySelector(
    'div[style*="font-size: 12px"][style*="color: rgba(55, 53, 47, 0.65)"]'
  );
  const urlElement = bookmarkElement.querySelector(
    'div[style*="font-size: 12px"][style*="color: rgb(55, 53, 47)"]'
  );

  const url = linkElement?.getAttribute("href") || "";
  const title = titleElement?.textContent || "";
  const description = descriptionElement?.textContent || "";
  const displayUrl = urlElement?.textContent || "";

  return {
    type: "bookmark",
    bookmark: {
      url: url,
      caption: [],
    },
    // Additional metadata that might be useful for rendering
    metadata: {
      title: title,
      description: description,
      displayUrl: displayUrl,
    },
  };
}
