import {Readable} from "stream";
import axios from "axios";
import {maxMediaSize} from "./env";
import {formatBytesIntoReadable} from "./text";
export function bufferToStream(binary) {
  const readableInstanceStream = new Readable({
    read() {
      this.push(binary);
      this.push(null);
    },
  });
  return readableInstanceStream;
}

export async function downloadFromUrl(url, name?: string) {
  if (!url || typeof url !== "string") {
    throw new Error("Invalid File URL provided");
  }

  const start = Date.now();
  try {
    const response = await axios({
      method: "get",
      url: url,
      responseType: "arraybuffer",
      timeout: 15 * 60 * 1000, // 15 minutes
      maxContentLength: maxMediaSize.bytes, // 100 MB max file size
    });

    const buffer = Buffer.from(response.data);
    const size = buffer.length;

    const duration = (Date.now() - start) / 1000;
    const speedMBps = size / duration / (1024 * 1024);

    console.info(
      `✓ Downloaded ${name || url}; Size: ${formatBytesIntoReadable(
        size
      )}, Speed: ${`${speedMBps.toFixed(2)} Mb/s`}, Time: ${`${duration.toFixed(2)} seconds`}`
    );

    return {
      size,
      buffer,
      contentType: response.headers["content-type"],
    };
  } catch (error) {
    console.log("Error while downloading file", error);
    throw error;
  }
}
