import {MediaFile, TransformedMedia} from "types";
import {getMediaRef} from "../src/_media";
import {makeMediaPostReady} from "../src/media";

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
      buffer: Buffer.from("test"),
    };

    const result = makeMediaPostReady<"file">(input);
    expect(result).toEqual(Object.assign(input, {transformation: null}));
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
      refId: "test-ref",
      mimeType: "png",
      contentType: "image/png",
      type: "image",
      size: 500,
      url: "https://example.com/test-optimized.jpg",
      transformation: {
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
      refId: "test-ref",
      mimeType: "image/jpeg",
      contentType: "image/jpeg",
      type: "image",
      size: 1000,
      url: "https://example.com/test.jpg",
      transformation: null,
    });
  });
});
