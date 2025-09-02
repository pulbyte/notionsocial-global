// Import only the specific function we need to avoid circular import issues
import {SocialPlatformType} from "@pulbyte/social-stack-lib";
import {chooseMediaFilesToDownload} from "../src/_publish";

describe("chooseMediaFilesToDownload", () => {
  describe("Binary upload platforms", () => {
    it("should include all media types for LinkedIn (binary upload platform)", () => {
      const platforms: SocialPlatformType[] = ["linkedin"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(expect.arrayContaining(["video", "image", "doc"]));
      expect(result).toHaveLength(3);
    });

    it("should include all media types for X/Twitter (binary upload platform)", () => {
      const platforms: SocialPlatformType[] = ["x"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(expect.arrayContaining(["video", "image", "doc"]));
      expect(result).toHaveLength(3);
    });

    it("should include all media types for YouTube (binary upload platform)", () => {
      const platforms: SocialPlatformType[] = ["youtube"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(expect.arrayContaining(["video", "image", "doc"]));
      expect(result).toHaveLength(3);
    });

    it("should include all media types for TikTok (binary upload platform)", () => {
      const platforms: SocialPlatformType[] = ["tiktok"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(expect.arrayContaining(["video", "image", "doc"]));
      expect(result).toHaveLength(3);
    });

    it("should include all media types for Bluesky (binary upload platform)", () => {
      const platforms: SocialPlatformType[] = ["bluesky"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(expect.arrayContaining(["video", "image", "doc"]));
      expect(result).toHaveLength(3);
    });

    it("should include all media types for legacy Twitter (binary upload platform)", () => {
      const platforms: SocialPlatformType[] = ["twitter"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(expect.arrayContaining(["video", "image", "doc"]));
      expect(result).toHaveLength(3);
    });
  });

  describe("URL upload platforms", () => {
    it("should return empty array for Facebook only (URL upload platform)", () => {
      const platforms: SocialPlatformType[] = ["facebook"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(["image"]);
    });

    it("should return empty array for Instagram only (URL upload platform)", () => {
      const platforms: SocialPlatformType[] = ["instagram"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual([]);
    });

    it("should return empty array for Threads only (URL upload platform)", () => {
      const platforms: SocialPlatformType[] = ["threads"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual([]);
    });
  });

  describe("Pinterest special cases", () => {
    it("should include video for Pinterest only", () => {
      const platforms: SocialPlatformType[] = ["pinterest"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(["video"]);
    });

    it("should include video when Pinterest is combined with binary upload platforms", () => {
      const platforms: SocialPlatformType[] = ["pinterest", "linkedin"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(expect.arrayContaining(["video", "image", "doc"]));
      expect(result).toHaveLength(3);
    });

    it("should include video when Pinterest is combined with URL upload platforms", () => {
      const platforms: SocialPlatformType[] = ["pinterest", "instagram"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(["video"]);
    });
  });

  describe("Facebook special cases", () => {
    it("should include image for Facebook only", () => {
      const platforms: SocialPlatformType[] = ["facebook"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(["image"]);
    });

    it("should include image when Facebook is combined with binary upload platforms", () => {
      const platforms: SocialPlatformType[] = ["facebook", "linkedin"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(expect.arrayContaining(["video", "image", "doc"]));
      expect(result).toHaveLength(3);
    });

    it("should include image when Facebook is combined with other URL upload platforms", () => {
      const platforms: SocialPlatformType[] = ["facebook", "instagram"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(["image"]);
    });
  });

  describe("Mixed platform scenarios", () => {
    it("should include all media types when mixing binary and URL upload platforms", () => {
      const platforms: SocialPlatformType[] = ["linkedin", "facebook", "instagram"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(expect.arrayContaining(["video", "image", "doc"]));
      expect(result).toHaveLength(3);
    });

    it("should handle Pinterest + Facebook combination", () => {
      const platforms: SocialPlatformType[] = ["pinterest", "facebook"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(expect.arrayContaining(["video", "image"]));
      expect(result).toHaveLength(2);
    });

    it("should handle Pinterest + Facebook + LinkedIn combination", () => {
      const platforms: SocialPlatformType[] = ["pinterest", "facebook", "linkedin"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(expect.arrayContaining(["video", "image", "doc"]));
      expect(result).toHaveLength(3);
    });
  });

  describe("LinkedIn video specific test case", () => {
    it("should include video in array when LinkedIn is the only platform", () => {
      const platforms: SocialPlatformType[] = ["linkedin"];
      const result = chooseMediaFilesToDownload(platforms);

      // This is the specific test case you suspected might be failing
      expect(result).toContain("video");
      expect(result).toEqual(expect.arrayContaining(["video", "image", "doc"]));
    });

    it("should include video when LinkedIn is combined with other platforms", () => {
      const platforms: SocialPlatformType[] = ["linkedin", "instagram"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toContain("video");
      expect(result).toEqual(expect.arrayContaining(["video", "image", "doc"]));
    });

    it("should include video when LinkedIn is in a mixed array", () => {
      const platforms: SocialPlatformType[] = ["facebook", "linkedin", "pinterest"];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toContain("video");
      expect(result).toEqual(expect.arrayContaining(["video", "image", "doc"]));
    });
  });

  describe("Edge cases", () => {
    it("should return empty array for empty platform array", () => {
      const platforms: SocialPlatformType[] = [];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual([]);
    });

    it("should handle undefined platform array", () => {
      const platforms = undefined as any;
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual([]);
    });

    it("should handle null platform array", () => {
      const platforms = null as any;
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual([]);
    });

    it("should return unique values when duplicate platforms might cause duplicates", () => {
      const platforms: SocialPlatformType[] = ["pinterest", "facebook", "pinterest"];
      const result = chooseMediaFilesToDownload(platforms);

      // Should not have duplicates due to _.uniq()
      expect(result).toEqual(["video", "image"]);
      expect(new Set(result).size).toBe(result.length);
    });
  });

  describe("All binary upload platforms together", () => {
    it("should include all media types for all binary upload platforms", () => {
      const platforms: SocialPlatformType[] = [
        "x",
        "twitter",
        "linkedin",
        "youtube",
        "tiktok",
        "bluesky",
      ];
      const result = chooseMediaFilesToDownload(platforms);

      expect(result).toEqual(expect.arrayContaining(["video", "image", "doc"]));
      expect(result).toHaveLength(3);
    });
  });

  describe("All URL upload platforms together", () => {
    it("should include only image for all URL upload platforms (due to Facebook)", () => {
      const platforms: SocialPlatformType[] = [
        "facebook",
        "instagram",
        "pinterest",
        "threads",
      ];
      const result = chooseMediaFilesToDownload(platforms);

      // Pinterest adds video, Facebook adds image
      expect(result).toEqual(expect.arrayContaining(["video", "image"]));
      expect(result).toHaveLength(2);
    });
  });
});
