import {Readable} from "stream";
import ogs from "open-graph-scraper";
export function bufferToStream(binary) {
  const readableInstanceStream = new Readable({
    read() {
      this.push(binary);
      this.push(null);
    },
  });
  return readableInstanceStream;
}
export function getOGData(url): Promise<{ogTitle; ogImage; ogSiteName}> {
  return new Promise((resolve, reject) => {
    const options = {url, onlyGetOpenGraphInfo: true};
    ogs(options)
      .then((data) => {
        if (data?.error || !data.result) return reject(data?.error);
        const result = data.result || {};
        const {ogTitle, ogImage, ogSiteName} = result;
        const toReturn = {ogTitle, ogImage: ogImage?.[0]?.url, ogSiteName};
        resolve(toReturn);
      })
      .catch((e) => {
        console.log("Error in gettting URL OG data", e?.result?.errorDetails);
        reject(e);
      });
  });
}
