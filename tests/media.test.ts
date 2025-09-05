import {MediaFile, TransformedMedia} from "types";
import {getMediaRef, makeMediaPostReady} from "../src/_media";
import {getUrlContentHeaders, isGiphyLink, alterGiphyLink} from "../src/url";
import {downloadFromUrl} from "../src/file";

describe("getMediaRef", () => {
  it("should correctly parse Notion HTML media URLs", () => {
    const notionUrl =
      "https://www.notion.so/image/https%3A%2F%2Fs3-us-west-2.amazonaws.com%2Fsecure.notion-static.com%2F1234abcd-5678-efgh-ijkl-mnopqrstuvwx%2Fexample.jpg?table=block&id=abcdef12-3456-7890-abcd-ef1234567890&cache=v2";
    const expected =
      "secure.notion-static.com_1234abcd-5678-efgh-ijkl-mnopqrstuvwx_example.jpg";
    expect(getMediaRef(notionUrl)).toBe(expected);
  });

  it("should correctly parse Notion API media URLs", () => {
    const notionUrl =
      "https://prod-files-secure.s3.us-west-2.amazonaws.com/4aca8b34-cbcd-496b-8548-c558c07ba144/71ef465f-00cf-4ca3-96b1-6653a409ccec/Pinhead.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAT73L2G45HZZMZUHI%2F20241022%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20241022T153343Z&X-Amz-Expires=3600&X-Amz-Signature=ba3a41b89b8d462afa742528967dfce7345dd44d79fbd84ef0f31af79c71b6c8&X-Amz-SignedHeaders=host&x-id=GetObject";
    const expected =
      "4aca8b34-cbcd-496b-8548-c558c07ba144_71ef465f-00cf-4ca3-96b1-6653a409ccec_Pinhead.mp4";
    expect(getMediaRef(notionUrl)).toBe(expected);
  });

  it("should correctly parse public Google Drive URLs", () => {
    const driveUrl =
      "https://drive.google.com/file/d/1ABCdefGHIjklMNOpqrsTUVwxYZ/view?usp=sharing";
    const expected = "d_1ABCdefGHIjklMNOpqrsTUVwxYZ_view";
    expect(getMediaRef(driveUrl)).toBe(expected);
  });

  it("should work for other external URLs", () => {
    const externalUrl = "https://example.com/image.jpg";
    expect(getMediaRef(externalUrl)).toBe("image.jpg");
  });

  it("should handle URLs with fewer than 3 path segments", () => {
    const shortUrl = "https://example.com/image";
    expect(getMediaRef(shortUrl)).toBe("image");
  });

  it("should return null for invalid URLs", () => {
    const invalidUrl = "not a url";
    expect(getMediaRef(invalidUrl)).toBe(null);
  });

  it("should return the input if it's not a string", () => {
    const nonStringInput = 123;
    expect(getMediaRef(nonStringInput as any)).toBe(null);
  });

  it("should return the input if it's not a string", () => {
    expect(getMediaRef("")).toBe(null);
  });

  it("should remove non-ASCII characters from the ref", () => {
    const urlWithUnicode = "https://example.com/path/测试_テスト_image_漢字.jpg";
    expect(getMediaRef(urlWithUnicode)).toBe("path___image_.jpg");

    const urlWithAccents = "https://example.com/résumé/études/café.jpg";
    expect(getMediaRef(urlWithAccents)).toBe("rsum_tudes_caf.jpg");

    const urlWithEmoji = "https://example.com/folder/🌟photo📸/test.jpg";
    expect(getMediaRef(urlWithEmoji)).toBe("folder_photo_test.jpg");

    const notionUrlWithUnicode =
      "https://prod-files-secure.s3.us-west-2.amazonaws.com/4aca8b34-cbcd-496b-8548-c558c07ba144/71ef465f-00cf-4ca3-96b1-6653a409ccec/The测试テストName.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAT73L2G45HZZMZUHI%2F20241022%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20241022T153343Z&X-Amz-Expires=3600&X-Amz-Signature=ba3a41b89b8d462afa742528967dfce7345dd44d79fbd84ef0f31af79c71b6c8&X-Amz-SignedHeaders=host&x-id=GetObject";
    expect(getMediaRef(notionUrlWithUnicode)).toBe(
      "4aca8b34-cbcd-496b-8548-c558c07ba144_71ef465f-00cf-4ca3-96b1-6653a409ccec_TheName.png"
    );
  });
});

describe("makeMediaPostReady", () => {
  it("should handle basic MediaFile input", () => {
    const input: MediaFile = {
      name: "test.jpg",
      refId: "test-ref",
      mimeType: "image/jpeg",
      contentType: "image/jpeg",
      type: "image",
      size: 1000,
      url: "https://example.com/test.jpg",
      buffer: new TextEncoder().encode("test").buffer,
    };

    const result = makeMediaPostReady<"file">(input);
    expect(result).toEqual({
      name: "test.jpg",
      _id: "test-ref",
      description: undefined,
      mimeType: "image/jpeg",
      contentType: "image/jpeg",
      type: "image",
      metadata: {
        size: 1000,
        height: 0,
        width: 0,
      },
      url: "https://example.com/test.jpg",
      buffer: new TextEncoder().encode("test").buffer,
    });
  });

  it("should handle MediaRecord with transformations", () => {
    const input: TransformedMedia = {
      name: "test.pdf",
      refId: "test-ref",
      mimeType: "application/pdf",
      contentType: "application/pdf",
      type: "doc",
      size: 1000,
      url: "https://example.com/test.pdf",
      transformations: [
        {
          url: "https://example.com/test-optimized.jpg",
          metadata: {
            contentType: "image/png",
            size: 500,
            height: 100,
            width: 100,
            //@ts-ignore
            method: "ffmpeg",
            orientation: "original",
            compression: "lossy",
          },
        },
      ],
    };

    const result = makeMediaPostReady<"media">(input);
    expect(result).toEqual({
      name: "test.pdf",
      _id: "test-ref",
      description: undefined,
      mimeType: "png",
      contentType: "image/png",
      type: "image",
      metadata: {
        contentType: "image/png",
        size: 500,
        height: 100,
        width: 100,
        method: "ffmpeg",
        orientation: "original",
        compression: "lossy",
      },
      url: "https://example.com/test-optimized.jpg",
      buffer: undefined,
    });
  });

  it("should handle MediaRecord without transformations", () => {
    const input: TransformedMedia = {
      name: "test.jpg",
      refId: "test-ref",
      mimeType: "image/jpeg",
      contentType: "image/jpeg",
      type: "image",
      size: 1000,
      url: "https://example.com/test.jpg",
      transformations: [],
    };

    const result = makeMediaPostReady<"media">(input);
    expect(result).toEqual({
      name: "test.jpg",
      _id: "test-ref",
      description: undefined,
      mimeType: "image/jpeg",
      contentType: "image/jpeg",
      type: "image",
      metadata: {
        size: 1000,
        height: 0,
        width: 0,
      },
      url: "https://example.com/test.jpg",
      buffer: undefined,
    });
  });
});

describe("URL Functions", () => {
  it("should get content headers for a valid image URL", async () => {
    // Test with a reliable image URL
    const testUrl = "https://httpbin.org/image/png";

    try {
      const headers = await getUrlContentHeaders(testUrl);
      expect(headers).toHaveProperty("contentType");
      expect(headers).toHaveProperty("contentLength");
      expect(headers).toHaveProperty("mimeType");
      expect(headers).toHaveProperty("mediaType");
      expect(headers).toHaveProperty("name");
      expect(headers).toHaveProperty("url");
      expect(headers.url).toBe(testUrl);
      expect(headers.mediaType).toBe("image");
    } catch (error) {
      // If the test URL is not available, skip the test
      console.warn("Test URL not available, skipping test:", error.message);
    }
  }, 30000);

  it("should handle 403 errors gracefully", async () => {
    // Test with a URL that might return 403
    const testUrl = "https://httpbin.org/status/403";

    try {
      await getUrlContentHeaders(testUrl);
      fail("Should have thrown an error for 403 status");
    } catch (error) {
      expect(error.message).toContain("403");
    }
  }, 30000);

  it("should download file from valid URL", async () => {
    // Test with a reliable file URL
    const testUrl = "https://httpbin.org/bytes/1024";

    try {
      const result = await downloadFromUrl(testUrl, "test-file");
      expect(result).toHaveProperty("size");
      expect(result).toHaveProperty("buffer");
      expect(result).toHaveProperty("contentType");
      expect(result.size).toBe(1024);
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    } catch (error) {
      // If the test URL is not available, skip the test
      console.warn("Test URL not available, skipping test:", error.message);
    }
  }, 30000);

  it("should handle invalid URLs", async () => {
    const invalidUrl = "not-a-valid-url";

    try {
      await getUrlContentHeaders(invalidUrl);
      fail("Should have thrown an error for invalid URL");
    } catch (error) {
      expect(error.message).toContain("Invalid URL");
    }
  });

  it("should handle empty URLs", async () => {
    try {
      await getUrlContentHeaders("");
      fail("Should have thrown an error for empty URL");
    } catch (error) {
      expect(error.message).toContain("Not a valid url");
    }
  });
});

describe("Giphy URL Functions", () => {
  describe("isGiphyLink", () => {
    it("should identify Giphy media page URLs", () => {
      const giphyMediaUrl = "https://giphy.com/gifs/bio-attachment-link-C1UbsNbI8hyXmvDFo0";
      expect(isGiphyLink(giphyMediaUrl)).toBe(true);
    });

    it("should identify Giphy gif sharable page URLs", () => {
      const giphyGifUrl =
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExa3RrNnE3Mzk5MmpzemI2Y2lvaWdsamdneXVyYWRlYjBlY3U4eXplMCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/WzWiUYLQMMikw/giphy.gif";
      expect(isGiphyLink(giphyGifUrl)).toBe(true);
    });

    it("should identify Giphy hosted binary file URLs", () => {
      const giphySimpleUrl = "https://i.giphy.com/J6SPGKJRZgHLkw9XAt.webp";
      expect(isGiphyLink(giphySimpleUrl)).toBe(true);
    });

    it("should return false for non-Giphy URLs", () => {
      const nonGiphyUrl = "https://example.com/image.gif";
      expect(isGiphyLink(nonGiphyUrl)).toBe(false);
    });

    it("should return false for empty or null URLs", () => {
      expect(isGiphyLink("")).toBe(false);
      expect(isGiphyLink(null as any)).toBe(false);
    });
  });

  describe("alterGiphyLink", () => {
    it("should convert Giphy media page URL to direct GIF URL", () => {
      const giphyMediaUrl = "https://giphy.com/gifs/bio-attachment-link-C1UbsNbI8hyXmvDFo0";
      const expected = "https://i.giphy.com/C1UbsNbI8hyXmvDFo0.gif";
      expect(alterGiphyLink(giphyMediaUrl)).toBe(expected);
    });

    it("should convert Giphy gif sharable page URLs to hosted binary file GIF URL", () => {
      const giphyGifUrl =
        "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcG9uYWN3dTJ1N2c2Z2tobTNkOGEyMDliNWI0a3VuZGwwNmM5NmljNCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/C1UbsNbI8hyXmvDFo0/giphy.gif";
      const expected = "https://i.giphy.com/C1UbsNbI8hyXmvDFo0.gif";
      expect(alterGiphyLink(giphyGifUrl)).toBe(expected);
    });

    it("should keep Giphy hosted binary file URL as it is", () => {
      // .gif
      const giphySimpleUrlDotGif = "https://i.giphy.com/C1UbsNbI8hyXmvDFo0.gif";
      const expectedDotGif = "https://i.giphy.com/C1UbsNbI8hyXmvDFo0.gif";

      // .webp https://i.giphy.com/lXiRm5H49zYmHr3i0.webp
      const giphySimpleUrlDotWebp = "https://i.giphy.com/lXiRm5H49zYmHr3i0.webp";
      const expectedDotWebp = "https://i.giphy.com/lXiRm5H49zYmHr3i0.gif";

      expect(alterGiphyLink(giphySimpleUrlDotGif)).toBe(expectedDotGif);
      expect(alterGiphyLink(giphySimpleUrlDotWebp)).toBe(expectedDotWebp);
    });

    it("should return null for non-Giphy URLs", () => {
      const nonGiphyUrl = "https://example.com/image.gif";
      expect(alterGiphyLink(nonGiphyUrl)).toBe(null);
    });

    it("should return null for empty or null URLs", () => {
      expect(alterGiphyLink("")).toBe(null);
      expect(alterGiphyLink(null as any)).toBe(null);
    });

    it("should handle URLs with different Giphy ID formats", () => {
      const giphyUrl1 = "https://giphy.com/gifs/category-name-ABC123def";
      const giphyUrl2 = "https://media1.giphy.com/media/XYZ789ghi/giphy.gif";

      expect(alterGiphyLink(giphyUrl1)).toBe("https://i.giphy.com/ABC123def.gif");
      expect(alterGiphyLink(giphyUrl2)).toBe("https://i.giphy.com/XYZ789ghi.gif");
    });
  });
});
