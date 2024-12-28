import {replaceLineBreaksWithEmptySpaces} from "../src/text";

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
