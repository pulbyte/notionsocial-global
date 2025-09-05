/**
 * Buffer utilities for handling different buffer types consistently
 * All internal APIs use Node.js Buffer, but web APIs may require ArrayBuffer
 */

/**
 * Converts Node.js Buffer to ArrayBuffer for web APIs that require it (fetch, Blob)
 */
export function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const underlying = buffer.buffer;
  if (underlying instanceof ArrayBuffer) {
    return underlying.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  // Handle SharedArrayBuffer case
  const newBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(newBuffer).set(new Uint8Array(underlying, buffer.byteOffset, buffer.byteLength));
  return newBuffer;
}

/**
 * Converts ArrayBuffer to Node.js Buffer for internal consistency
 */
export function arrayBufferToBuffer(arrayBuffer: ArrayBuffer): Buffer {
  return Buffer.from(arrayBuffer);
}

/**
 * Ensures we have Buffer regardless of input type
 */
export function ensureBuffer(input: ArrayBuffer | Buffer | SharedArrayBuffer): Buffer {
  if (Buffer.isBuffer(input)) {
    return input;
  }
  
  if (input instanceof ArrayBuffer) {
    return Buffer.from(input);
  }
  
  // SharedArrayBuffer case
  return Buffer.from(input);
}

/**
 * Creates a Uint8Array view for byte-level operations on Buffer
 */
export function getByteView(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer);
}