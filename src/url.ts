import {convertToHttps} from "_url";
import urlMetadata from "url-metadata";

async function getDescriptVideoUrl(shareUrl: string) {
  const metadata = await urlMetadata(shareUrl);
  return metadata["descript:video"] as string;
}
export async function alterDescriptLink(inputURL: string) {
  try {
    const videoUrl = await getDescriptVideoUrl(inputURL);
    return videoUrl;
  } catch (error) {
    console.error("Error fetching Descript video URL:", error);
    return null;
  }
}

// Inside files, Cause it's a server function, And can't run in browser
export function getOGData(
  url: string
): Promise<{ogTitle: string; ogImage: string; ogSiteName: string}> {
  return urlMetadata(convertToHttps(url))
    .then((metadata) => {
      const _url = new URL(metadata.url);

      const ogTitle = metadata["title"] || metadata["og:title"] || metadata["twitter:title"];
      let ogImage =
        metadata["image"] ||
        metadata["og:image"] ||
        metadata["twitter:image"] ||
        metadata["imgTags"]?.find((_) => !!_.alt && !_.src?.startsWith("data:image"))?.["src"];
      if (ogImage?.startsWith("/")) ogImage = _url.origin + ogImage;
      const ogSiteName =
        metadata["og:site_name"] ||
        metadata["twitter:site"] ||
        metadata["jsonld"]?.[0]?.name ||
        _url.host ||
        url;

      const data = {
        ogTitle,
        ogImage,
        ogSiteName,
      };
      console.log("OG Data for", url, data);
      return data;
    })
    .catch((e) => {
      console.log(`Error in getting URL ${url} OG data`, e);
      throw e;
    });
}
