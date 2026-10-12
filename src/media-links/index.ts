import {canvaImageUrl} from "./canva";
import {linkError} from "./errors";
import {listDriveFolder} from "./drive";
import {driveFileUrl, driveFolderId, isCanvaLink, isDriveLink} from "./links";
import type {HttpGet} from "./schema";

export {MediaLinkError} from "./errors";

export {MAX_PDF_PAGES, isPdf, pageRef, withPdfPages} from "./pdf";

export type {HttpAnswer} from "./schema";

// fromUrl: the media file a direct link gives, null when it gives none (legacy header fetch).
export type LinkDeps<M> = {get: HttpGet; fromUrl: (url: string) => Promise<M | null>; driveApiKey?: string};

async function folderMedia<M>(id: string, deps: LinkDeps<M>): Promise<M[]> {
  const files = await listDriveFolder(id, deps.get, deps.driveApiKey);
  const media: M[] = [];

  // One at a time: Drive rate-limits parallel downloads from one folder.
  for (const f of files) {
    const url = driveFileUrl(f.id);
    const m = await deps.fromUrl(url);

    if (!m) throw linkError("drive-restricted", url);

    media.push(m);
  }

  return media;
}

// #65: the media a pasted link stands for. A Drive folder gives its files; a Canva design gives
// its image; any other link the file it points to. Drive and Canva links that give no file throw
// a MediaLinkError with the catalogue text; other links that give none return [] as before.
export async function mediaFromLink<M>(url: string, deps: LinkDeps<M>): Promise<M[]> {
  const folder = driveFolderId(url);

  if (folder) return folderMedia(folder, deps);

  if (isCanvaLink(url)) {
    const m = await deps.fromUrl(await canvaImageUrl(url, deps.get));

    if (!m) throw linkError("canva-link", url);

    return [m];
  }

  const m = await deps.fromUrl(url);

  if (!m && isDriveLink(url)) throw linkError("drive-restricted", url);

  return m ? [m] : [];
}
