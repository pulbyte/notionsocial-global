import {getMediaRef} from "../src/_media";

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
});
