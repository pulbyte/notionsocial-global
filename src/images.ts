import gifFrames from "gif-frames";
import sharp from "sharp";
import {getByteView} from "./buffer";

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
  detectedFormat?: string;
}

export async function validateImageBuffer(
  buffer: Buffer
): Promise<ImageValidationResult> {
  try {
    // Check if buffer exists and has content
    if (!buffer || buffer.length === 0) {
      return {
        isValid: false,
        error: "Empty or null buffer provided",
      };
    }

    // Check minimum buffer size (most images need at least 10 bytes for headers)
    if (buffer.length < 10) {
      return {
        isValid: false,
        error: `Buffer too small (${buffer.length} bytes). Minimum 10 bytes required.`,
      };
    }

    // Create a view to access bytes
    const bytes = getByteView(buffer);

    // Check for common image file signatures
    const imageFormats = [
      {name: "JPEG", signature: [0xff, 0xd8, 0xff]},
      {name: "PNG", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]},
      {name: "GIF87a", signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]},
      {name: "GIF89a", signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]},
      {name: "BMP", signature: [0x42, 0x4d]},
      {name: "WEBP", signature: [0x52, 0x49, 0x46, 0x46]}, // RIFF header for WebP
      {name: "TIFF (LE)", signature: [0x49, 0x49, 0x2a, 0x00]},
      {name: "TIFF (BE)", signature: [0x4d, 0x4d, 0x00, 0x2a]},
    ];

    let detectedFormat: string | undefined;
    let hasValidSignature = false;

    for (const format of imageFormats) {
      if (format.signature.every((byte, i) => i < bytes.length && bytes[i] === byte)) {
        hasValidSignature = true;
        detectedFormat = format.name;
        break;
      }
    }

    // Special check for WebP which has additional validation after RIFF
    if (detectedFormat === "WEBP" && bytes.length >= 12) {
      const webpSignature = [0x57, 0x45, 0x42, 0x50]; // 'WEBP'
      const isWebP = webpSignature.every((byte, i) => bytes[8 + i] === byte);
      if (!isWebP) {
        hasValidSignature = false;
        detectedFormat = undefined;
      }
    }

    if (!hasValidSignature) {
      return {
        isValid: false,
        error: "Buffer does not contain a valid image file signature",
        detectedFormat: undefined,
      };
    }

    // Try to parse with Sharp for additional validation
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        return {
          isValid: false,
          error: "Image metadata is missing width or height information",
          detectedFormat,
        };
      }
    } catch (sharpError) {
      return {
        isValid: false,
        error: `Sharp validation failed: ${
          sharpError instanceof Error ? sharpError.message : String(sharpError)
        }`,
        detectedFormat,
      };
    }

    return {
      isValid: true,
      detectedFormat,
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function getGifFrameCount(buffer: Buffer): Promise<number> {
  try {
    const frameData = await gifFrames({url: buffer, frames: "all"});
    return frameData.length;
  } catch (error) {
    console.error("Error analyzing GIF:", error);
    return 0;
  }
}

export async function getImagePixelCount(buffer: Buffer): Promise<number> {
  try {
    // First validate the buffer
    const validation = await validateImageBuffer(buffer);
    if (!validation.isValid) {
      console.error("Image buffer validation failed:", validation.error);
      return 0;
    }

    const {width, height} = await sharp(buffer).metadata();
    return (width ?? 0) * (height ?? 0);
  } catch (error) {
    console.error("Error analyzing image:", error);
    return 0;
  }
}
