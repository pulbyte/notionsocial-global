import {replaceLineBreaksWithEmptySpaces} from "../src/text";
import {processInstagramTags} from "../src/text";

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
