import {replaceLineBreaksWithEmptySpaces, splitByEmDashes} from "../src/text";
import {processInstagramTags} from "../src/text";
import {formatMarkdown} from "../src/parser";

describe("replaceLineBreaksWithEmptySpaces", () => {
  it("should handle ending line with a line break in a paragraph", () => {
    const input = "Hello\nWorld";
    const output = replaceLineBreaksWithEmptySpaces(input);
    console.log("Input:", JSON.stringify(input));
    console.log("Output:", JSON.stringify(output));
    expect(output).toBe("Hello\nWorld");
  });

  it("should handle a creating a new line in a paragraph", () => {
    const input = "Hello\n\nWorld";
    const output = replaceLineBreaksWithEmptySpaces(input);
    console.log("Input:", JSON.stringify(input));
    console.log("Output:", JSON.stringify(output));
    expect(output).toBe("Hello\n\nWorld");
  });

  it("should handle adding a full blank line break", () => {
    const input = "Hello\n\n\nWorld";
    const output = replaceLineBreaksWithEmptySpaces(input);
    console.log("Input:", JSON.stringify(input));
    console.log("Output:", JSON.stringify(output));
    expect(output).toBe("Hello\n \n \nWorld");
  });

  it("should handle adding a 2 blank line breaks", () => {
    const input = "Hello\n\n\n\nWorld";
    const output = replaceLineBreaksWithEmptySpaces(input);
    console.log("Input:", JSON.stringify(input));
    console.log("Output:", JSON.stringify(output));
    expect(output).toBe("Hello\n \n\n \nWorld");
  });

  it("should handle adding a 3 blank line breaks", () => {
    const input = "Hello\n\n\n\n\nWorld";
    const output = replaceLineBreaksWithEmptySpaces(input);
    console.log("Input:", JSON.stringify(input));
    console.log("Output:", JSON.stringify(output));
    expect(output).toBe("Hello\n \n\n \n \nWorld");
  });

  it("should handle adding a 4 blank line breaks", () => {
    const input = "Hello\n\n\n\n\n\nWorld";
    const output = replaceLineBreaksWithEmptySpaces(input);
    console.log("Input:", JSON.stringify(input));
    console.log("Output:", JSON.stringify(output));
    expect(output).toBe("Hello\n \n\n \n\n \nWorld");
  });

  it("should trim whitespace from lines", () => {
    const input = "  Hello  \n  World  ";
    const output = replaceLineBreaksWithEmptySpaces(input);
    console.log("Input:", JSON.stringify(input));
    console.log("Output:", JSON.stringify(output));
    expect(output).toBe("Hello\nWorld");
  });

  it("should handle empty input", () => {
    console.log("Testing empty string input");
    expect(replaceLineBreaksWithEmptySpaces("")).toBe("");

    console.log("Testing null input");
    expect(replaceLineBreaksWithEmptySpaces(null as any)).toBe("");

    console.log("Testing undefined input");
    expect(replaceLineBreaksWithEmptySpaces(undefined as any)).toBe("");
  });

  it("should handle mixed single and multiple line breaks", () => {
    const input = "Line1\nLine2\n\nLine3\n Line4 \n\n\nLine5 \n\n";
    const output = replaceLineBreaksWithEmptySpaces(input);
    console.log("Input:", JSON.stringify(input));
    console.log("Output:", JSON.stringify(output));
    expect(output).toBe("Line1\nLine2\n\nLine3\nLine4\n \n \nLine5\n\n");
  });
});

describe("processInstagramTags", () => {
  it("should handle various Instagram username formats", () => {
    const input = [
      "@username",
      "username2",
      "https://instagram.com/username3",
      "https://www.instagram.com/user_name4",
    ];
    const expected = ["username", "username2", "username3", "user_name4"];
    expect(processInstagramTags(input)).toEqual(expected);
  });

  it("should filter out invalid usernames and empty values", () => {
    const input = [
      "@valid_user",
      "invalid username",
      "",
      null,
      undefined,
      "https://instagram.com/valid-user2",
    ];
    const expected = ["valid_user", "valid-user2"];
    expect(processInstagramTags(input)).toEqual(expected);
  });

  it("should handle empty or invalid input arrays", () => {
    expect(processInstagramTags([])).toEqual([]);
    expect(processInstagramTags(null as any)).toEqual([]);
    expect(processInstagramTags(undefined as any)).toEqual([]);
  });
});

describe("formatMarkdown", () => {
  it("should strip HTML tags with notion-color attributes", () => {
    const input =
      "<span notion-color='gray'>You can use this space to draft or write your caption. Once you have the final version of your caption, paste it into the </span><span notion-color='gray'>_Caption_</span><span notion-color='gray'> field so that it can be visible (and searchable) in your </span><span notion-color='gray'>_Captions tab in the _</span><span notion-color='gray'>_Content Planning_</span><span notion-color='gray'>_ _</span>";
    const result = formatMarkdown(input);
    console.log("Input HTML:", input);
    console.log("Actual:", result);

    // Should strip all HTML tags
    expect(result).not.toContain("<span");
    expect(result).not.toContain("</span>");
    expect(result).not.toContain("notion-color");

    // Should contain the core text content
    expect(result).toContain("You can use this space to draft or write your caption");
    expect(result).toContain("field so that it can be visible");
  });

  it("should handle mixed HTML tags and markdown", () => {
    const input = "<span notion-color='blue'>**Bold text**</span> and <em>italic text</em>";
    const result = formatMarkdown(input);

    // Should strip all HTML tags
    expect(result).not.toContain("<span");
    expect(result).not.toContain("</span>");
    expect(result).not.toContain("<em>");
    expect(result).not.toContain("notion-color");

    // Should contain the text content (though may be formatted)
    expect(result).toContain("text");
    expect(result).toContain("and");
  });

  it("should handle HTML entities", () => {
    const input = "Test &amp; more &lt;text&gt; &quot;quotes&quot;";
    const result = formatMarkdown(input);
    expect(result).toBe('Test & more <text> "quotes"');
  });
});

describe("splitByEmDashes", () => {
  it("should split text by double em dashes", () => {
    const input = "First part—— Second part";
    const result = splitByEmDashes(input);
    expect(result).toEqual(["First part", "Second part"]);
  });

  it("should split text by double hyphens", () => {
    const input = "First part-- Second part";
    const result = splitByEmDashes(input);
    expect(result).toEqual(["First part", "Second part"]);
  });

  it("should split text by mixed em dashes and hyphens", () => {
    const input = "First part—- Second part";
    const result = splitByEmDashes(input);
    expect(result).toEqual(["First part", "Second part"]);
  });

  it("should handle multiple separators in one text", () => {
    const input = "Part 1—— Part 2-- Part 3—- Part 4";
    const result = splitByEmDashes(input);
    expect(result).toEqual(["Part 1", "Part 2", "Part 3", "Part 4"]);
  });

  it("should handle whitespace around separators", () => {
    const input = "First part  ——  Second part";
    const result = splitByEmDashes(input);
    expect(result).toEqual(["First part", "Second part"]);
  });

  it("should handle more than two consecutive dashes", () => {
    const input = "First part——— Second part---- Third part";
    const result = splitByEmDashes(input);
    expect(result).toEqual(["First part", "Second part", "Third part"]);
  });

  it("should trim whitespace from resulting parts", () => {
    const input = "  First part  ——   Second part  ";
    const result = splitByEmDashes(input);
    expect(result).toEqual(["First part", "Second part"]);
  });

  it("should filter out empty parts", () => {
    const input = "——First part——Second part——";
    const result = splitByEmDashes(input);
    expect(result).toEqual(["First part", "Second part"]);
  });

  it("should handle text with no separators", () => {
    const input = "This is a single part with no separators";
    const result = splitByEmDashes(input);
    expect(result).toEqual(["This is a single part with no separators"]);
  });

  it("should handle empty string input", () => {
    const input = "";
    const result = splitByEmDashes(input);
    expect(result).toEqual([]);
  });

  it("should handle null input", () => {
    const input = null;
    const result = splitByEmDashes(input as any);
    expect(result).toEqual([]);
  });

  it("should handle undefined input", () => {
    const input = undefined;
    const result = splitByEmDashes(input as any);
    expect(result).toEqual([]);
  });

  it("should handle single dash (should not split)", () => {
    const input = "First part - Second part";
    const result = splitByEmDashes(input);
    expect(result).toEqual(["First part - Second part"]);
  });

  it("should handle complex text with multiple types of content", () => {
    const input =
      "Introduction paragraph with details—— Main content section with key points-- Conclusion with final thoughts";
    const result = splitByEmDashes(input);
    expect(result).toEqual([
      "Introduction paragraph with details",
      "Main content section with key points",
      "Conclusion with final thoughts",
    ]);
  });

  it("should handle text with only separators", () => {
    const input = "————————";
    const result = splitByEmDashes(input);
    expect(result).toEqual([]);
  });

  it("should handle separators with only whitespace between them", () => {
    const input = "——   ——   ——";
    const result = splitByEmDashes(input);
    expect(result).toEqual([]);
  });

  it("should handle newlines within parts", () => {
    const input = "First part\nwith newline—— Second part\nwith newline";
    const result = splitByEmDashes(input);
    expect(result).toEqual(["First part\nwith newline", "Second part\nwith newline"]);
  });

  it("should handle special characters within parts", () => {
    const input = "Part with @special #characters—— Part with $symbols & more!";
    const result = splitByEmDashes(input);
    expect(result).toEqual(["Part with @special #characters", "Part with $symbols & more!"]);
  });

  it("should handle spaced dashes like '- - -'", () => {
    const input = "\n- - -\n\n";
    const result = splitByEmDashes(input);
    console.log("Input:", JSON.stringify(input));
    console.log("Result:", result);
    console.log("Result length:", result.length);
    // Now the regex handles spaced dash patterns, so it should split and return empty
    expect(result).toEqual([]);
  });

  it("should split text with spaced dash separators", () => {
    const input = "Part 1\n- - -\nPart 2";
    const result = splitByEmDashes(input);
    console.log("Spaced dashes input:", JSON.stringify(input));
    console.log("Spaced dashes result:", result);
    // Now this SHOULD split because "- - -" is recognized as a separator
    expect(result).toEqual(["Part 1", "Part 2"]);
  });

  it("should handle various spaced dash patterns", () => {
    const input = "Part 1— — —Part 2- - - -Part 3—  -  —Part 4";
    const result = splitByEmDashes(input);
    expect(result).toEqual(["Part 1", "Part 2", "Part 3", "Part 4"]);
  });

  it("should handle mixed consecutive and spaced dashes", () => {
    const input = "Part 1—— Part 2- - -Part 3-- Part 4— - Part 5";
    const result = splitByEmDashes(input);
    expect(result).toEqual(["Part 1", "Part 2", "Part 3", "Part 4", "Part 5"]);
  });

  it("should handle your original suspicious case", () => {
    const input = "'\n'- - -'\n''\n'";
    const result = splitByEmDashes(input);
    console.log("Your original case input:", JSON.stringify(input));
    console.log("Your original case result:", result);
    // This should now split properly on "- - -"
    // The newlines are preserved within the parts
    expect(result).toEqual(["'\n'", "'\n''\n'"]);
  });

  it("should handle actual consecutive dashes with newlines", () => {
    const input = "Part 1\n--\nPart 2 ---Part 3\n\n ---\n\n Part 4";
    const result = splitByEmDashes(input);
    console.log("Consecutive dashes with newlines input:", JSON.stringify(input));
    console.log("Consecutive dashes with newlines result:", result);
    // This SHOULD split because "--" are consecutive dashes
    expect(result).toEqual(["Part 1", "Part 2", "Part 3", "Part 4"]);
  });
});
