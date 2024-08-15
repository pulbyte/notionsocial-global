import {Readable} from "stream";
export function getFileNameFromContentDisposition(contentDisposition) {
  if (!contentDisposition) return null;
  const regex = /filename="(.*?)"/;
  const match = contentDisposition.match(regex);

  if (match && match[1]) {
    return match[1];
  } else {
    return null; // No filename found
  }
}

export function bufferToStream(binary) {
  const readableInstanceStream = new Readable({
    read() {
      this.push(binary);
      this.push(null);
    },
  });
  return readableInstanceStream;
}
