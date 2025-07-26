import {replaceLineBreaksWithEmptySpaces} from "../src/text";
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
    const input = "<span notion-color='gray'>You can use this space to draft or write your caption. Once you have the final version of your caption, paste it into the </span><span notion-color='gray'>_Caption_</span><span notion-color='gray'> field so that it can be visible (and searchable) in your </span><span notion-color='gray'>_Captions tab in the _</span><span notion-color='gray'>_Content Planning_</span><span notion-color='gray'>_ _</span>";
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
