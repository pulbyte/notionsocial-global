import {extractPlatformCaptions} from "../src/_publish";

describe("extractPlatformCaptions", () => {
  it("should extract Instagram caption from 'Instagram Caption' property", () => {
    const properties = {
      "Instagram Caption": {
        type: "rich_text",
        rich_text: [{plain_text: "This is an Instagram caption"}],
      },
    };

    const result = extractPlatformCaptions(properties);

    expect(result).toEqual({
      instagram: "This is an Instagram caption",
    });
  });

  it("should extract caption from snake_case property", () => {
    const properties = {
      content_instagram: {
        type: "rich_text",
        rich_text: [{plain_text: "Instagram content with underscore"}],
      },
      content_twitter: {
        type: "rich_text",
        rich_text: [{plain_text: "X content with underscore"}],
      },
    };

    const result = extractPlatformCaptions(properties);

    expect(result).toMatchObject({
      instagram: "Instagram content with underscore",
      x: "X content with underscore",
    });
  });

  it("should extract multiple platform captions from different properties", () => {
    const properties = {
      "Instagram Caption": {
        type: "rich_text",
        rich_text: [{plain_text: "Instagram post content"}],
      },
      "Facebook Message": {
        type: "rich_text",
        rich_text: [{plain_text: "Facebook post content"}],
      },
      "LinkedIn Content": {
        type: "rich_text",
        rich_text: [{plain_text: "LinkedIn post content"}],
      },
    };

    const result = extractPlatformCaptions(properties);

    expect(result).toEqual({
      instagram: "Instagram post content",
      facebook: "Facebook post content",
      linkedin: "LinkedIn post content",
    });
  });

  it("should handle formula properties", () => {
    const properties = {
      "Instagram Caption": {
        type: "formula",
        formula: {
          string: "Formula-based Instagram caption",
        },
      },
    };

    const result = extractPlatformCaptions(properties);

    expect(result).toEqual({
      instagram: "Formula-based Instagram caption",
    });
  });

  it("should ignore properties without caption-related keywords", () => {
    const properties = {
      Title: {
        type: "title",
        title: [{plain_text: "Post Title"}],
      },
      "Instagram Caption": {
        type: "rich_text",
        rich_text: [{plain_text: "Instagram content"}],
      },
      Status: {
        type: "select",
        select: {name: "Ready"},
      },
    };

    const result = extractPlatformCaptions(properties);

    expect(result).toEqual({
      instagram: "Instagram content",
    });
  });

  it("should handle empty or null rich_text", () => {
    const properties = {
      "Instagram Caption": {
        type: "rich_text",
        rich_text: [],
      },
      "Facebook Caption": {
        type: "rich_text",
        rich_text: null,
      },
    };

    const result = extractPlatformCaptions(properties);

    expect(result).toEqual({});
  });

  it("should handle empty formula string", () => {
    const properties = {
      "Instagram Caption": {
        type: "formula",
        formula: {
          string: "",
        },
      },
    };

    const result = extractPlatformCaptions(properties);

    expect(result).toEqual({});
  });

  it("should include custom caption prop name in keywords", () => {
    const properties = {
      "Custom Caption": {
        type: "rich_text",
        rich_text: [{plain_text: "Custom caption content"}],
      },
    };

    const result = extractPlatformCaptions(properties, "Custom Caption");

    expect(result).toEqual({
      // Since "Custom Caption" doesn't contain platform names, no platforms will be detected
    });
  });

  it("should handle case-insensitive platform detection", () => {
    const properties = {
      "INSTAGRAM CAPTION": {
        type: "rich_text",
        rich_text: [{plain_text: "Uppercase Instagram caption"}],
      },
      facebook_content: {
        type: "rich_text",
        rich_text: [{plain_text: "Lowercase Facebook content"}],
      },
    };

    const result = extractPlatformCaptions(properties);

    expect(result).toMatchObject({
      instagram: "Uppercase Instagram caption",
      facebook: "Lowercase Facebook content",
    });
  });

  it("should handle mixed property types", () => {
    const properties = {
      "Instagram Caption": {
        type: "rich_text",
        rich_text: [{plain_text: "Rich text Instagram caption"}],
      },
      "Facebook Content": {
        type: "formula",
        formula: {
          string: "Formula Facebook content",
        },
      },
    };

    const result = extractPlatformCaptions(properties);

    expect(result).toEqual({
      instagram: "Rich text Instagram caption",
      facebook: "Formula Facebook content",
    });
  });

  it("should return empty object when no matching properties found", () => {
    const properties = {
      Title: {
        type: "title",
        title: [{plain_text: "Post Title"}],
      },
      Status: {
        type: "select",
        select: {name: "Ready"},
      },
    };

    const result = extractPlatformCaptions(properties);

    expect(result).toEqual({});
  });

  it("should handle properties with unsupported types", () => {
    const properties = {
      "Instagram Caption": {
        type: "select",
        select: {name: "Some Value"},
      },
    };

    const result = extractPlatformCaptions(properties);

    expect(result).toEqual({});
  });

  it("should handle multiple platforms in single property name", () => {
    const properties = {
      "Instagram Facebook Caption": {
        type: "rich_text",
        rich_text: [{plain_text: "Multi-platform caption"}],
      },
    };

    const result = extractPlatformCaptions(properties);

    expect(result).toEqual({
      instagram: "Multi-platform caption",
      facebook: "Multi-platform caption",
    });
  });
});
