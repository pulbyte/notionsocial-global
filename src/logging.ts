import {dev} from "./env";
import chalk from "chalk";
import {formatBytesIntoReadable} from "./text";

export function dog(...args: any[]) {
  if (dev && args?.length > 0) {
    args.forEach(prettyLog);
  }
}

// Local implementation of safeStringify with angle bracket formatting for buffers
export function safeStringify(obj) {
  function preProcess(value, path = "") {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value !== "object") {
      return value;
    }

    const processed = Array.isArray(value) ? [] : {};
    seen.set(value, path);

    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const newPath = path ? `${path}.${key}` : key;
        const val = value[key];

        // if (typeof val === "object" && val !== null) {
        //   if (seen.has(val)) {
        //     processed[key] = "<Circular>";
        //     continue;
        //   }
        // }

        // Handle Buffer objects with hex display and size
        if (Buffer.isBuffer(val)) {
          const formattedSize = formatBytesIntoReadable(val.length);
          processed[key] = `<Buffer: ${val.length} Bytes (${formattedSize})>`;
          continue;
        }

        // Handle TypedArrays
        if (
          val instanceof Uint8Array ||
          val instanceof Int8Array ||
          val instanceof Uint16Array ||
          val instanceof Int16Array ||
          val instanceof Uint32Array ||
          val instanceof Int32Array ||
          val instanceof Float32Array ||
          val instanceof Float64Array ||
          (val && val.buffer && val.buffer instanceof ArrayBuffer)
        ) {
          const typeName = val.constructor ? val.constructor.name : "TypedArray";
          const elementsPreview =
            val.length > 5
              ? Array.from(val.slice(0, 5)).join(", ")
              : Array.from(val).join(", ");

          const moreElements = val.length > 5 ? ` ... ${val.length - 5} more elements` : "";
          processed[key] = `<${typeName}: ${elementsPreview}${moreElements}>`;
          continue;
        }

        processed[key] = preProcess(val, newPath);
      }
    }

    return processed;
  }

  const seen = new Map();
  const processedObj = preProcess(obj);
  return JSON.stringify(processedObj, null, 2);
}

// Format values with colors
export function formatWithColors(value: any, indent = 0): string {
  const spaces = " ".repeat(indent);

  if (value === null) {
    return chalk.gray("null");
  }

  if (value === undefined) {
    return chalk.gray("undefined");
  }

  if (typeof value === "string") {
    // Check if it's a special formatted string like <Buffer: X bytes>
    if (value.startsWith("<Buffer:")) {
      // Extract parts for colorization
      return value.replace(/<Buffer: (.*?) Bytes \((.*?)\)>/, (_, byteCount, size) => {
        return (
          chalk.blue("<") +
          chalk.yellow("Buffer: ") +
          chalk.magentaBright(byteCount) +
          chalk.yellow(" Bytes (") +
          chalk.yellow(size) +
          chalk.yellow(")") +
          chalk.blue(">")
        );
      });
    }

    if (
      value.startsWith("<TypedArray:") ||
      value.startsWith("<Uint8Array") ||
      value.startsWith("<Float")
    ) {
      // Apply green color to angle brackets for typed arrays too
      return value.replace(/(<)(.*?)(>)/, (_, open, content, close) => {
        return chalk.blue(open) + chalk.yellow(content) + chalk.blue(close);
      });
    }

    if (value === "<Circular>") {
      return chalk.gray(value);
    }

    return chalk.green(`"${value}"`);
  }

  if (typeof value === "number") {
    return chalk.cyan(value);
  }

  if (typeof value === "boolean") {
    return chalk.yellow(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return chalk.gray("[]");
    }

    const formattedItems = value
      .map((item) => `${spaces}  ${formatWithColors(item, indent + 2)}`)
      .join(",\n");

    return `${chalk.white("[")}
${formattedItems}
${spaces}${chalk.white("]")}`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);

    if (keys.length === 0) {
      return chalk.gray("{}");
    }

    // If indent is 0, we are at the top level
    const isTopLevel = indent === 0;

    const formattedEntries = keys
      .map((key) => {
        const formattedValue = formatWithColors(value[key], indent + 2);
        // Make top-level keys bold, otherwise normal
        const keyStr = isTopLevel ? chalk.bold.white(`"${key}"`) : chalk.white(`"${key}"`);
        return `${spaces}  ${keyStr}${chalk.gray(":")} ${formattedValue}`;
      })
      .join(",\n");

    return `${chalk.white("{")}
${formattedEntries}
${spaces}${chalk.white("}")}`;
  }

  return String(value);
}

// Pretty log function
export function prettyLog(obj: any): void {
  if (
    obj === null ||
    obj === undefined ||
    typeof obj === "string" ||
    typeof obj === "number" ||
    typeof obj === "boolean"
  ) {
    const colorized = formatWithColors(obj);
    console.log(colorized);
    return;
  }

  const safeStr = safeStringify(obj);

  try {
    const parsed = JSON.parse(safeStr);
    const colorized = formatWithColors(parsed);
    console.log(colorized);
  } catch (err) {
    console.log(safeStr);
  }
}
