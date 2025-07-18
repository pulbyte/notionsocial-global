import {parseTextForLinkedInPost} from "../src/_content";

describe("parseTextForLinkedInPost", () => {
  test("should handle LinkedIn post URL with query parameters", () => {
    const text =
      "https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7350857682775396353?collapsed=1";
    const result = parseTextForLinkedInPost(text);

    expect(result.text).toBe("");
    expect(result.repostId).toBe("urn:li:ugcPost:7350857682775396353");
    expect(result.quotePostId).toBeNull();
    expect(result.replyToPostId).toBeNull();
  });

  test("should handle LinkedIn post URL without query parameters", () => {
    const text =
      "https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7350857682775396353";
    const result = parseTextForLinkedInPost(text);

    expect(result.text).toBe("");
    expect(result.repostId).toBe("urn:li:ugcPost:7350857682775396353");
    expect(result.quotePostId).toBeNull();
    expect(result.replyToPostId).toBeNull();
  });

  test("should handle text with LinkedIn post URL at the beginning", () => {
    const text =
      "https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7350857682775396353?collapsed=1 This is a reply to the post";
    const result = parseTextForLinkedInPost(text);

    expect(result.text).toBe("This is a reply to the post");
    expect(result.replyToPostId).toBe("urn:li:ugcPost:7350857682775396353");
    expect(result.quotePostId).toBeNull();
    expect(result.repostId).toBeNull();
  });

  test("should handle text with LinkedIn post URL at the end", () => {
    const text =
      "Check out this post https://www.linkedin.com/embed/feed/update/urn:li:share:7345123456789012345?queryParam=test";
    const result = parseTextForLinkedInPost(text);

    expect(result.text).toBe("Check out this post");
    expect(result.quotePostId).toBe("urn:li:share:7345123456789012345");
    expect(result.replyToPostId).toBeNull();
    expect(result.repostId).toBeNull();
  });
});
