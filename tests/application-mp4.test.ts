import {
  getMediaTypeFromContentType,
  getMimeTypeFromContentType,
  normalizeContentType,
} from "../src/_media";

describe("application/mp4 content type", () => {
  it("reads as an mp4 video", () => {
    expect(normalizeContentType("application/mp4")).toBe("video/mp4");
    expect(getMimeTypeFromContentType("application/mp4")).toBe("mp4");
    expect(getMediaTypeFromContentType("application/mp4")).toBe("video");
  });

  it("leaves other types alone", () => {
    expect(normalizeContentType("video/mp4;codecs=avc1")).toBe("video/mp4;codecs=avc1");
    expect(getMediaTypeFromContentType("application/pdf")).toBe("doc");
  });
});
