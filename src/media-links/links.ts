// #65: which kind of media link a URL is. Pure, no I/O.
const DRIVE_HOST = /(^|\.)(drive|docs|drive\.usercontent)\.google\.com$/;

const CANVA_HOST = /(^|\.)canva\.(com|link)$/;

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export const isDriveLink = (url: string) => DRIVE_HOST.test(hostOf(url)) || hostOf(url) === "www.googleapis.com";

export const isCanvaLink = (url: string) => CANVA_HOST.test(hostOf(url));

// drive.google.com/drive/folders/<id>, also /drive/u/0/folders/<id>.
export function driveFolderId(url: string): string | undefined {
  if (!DRIVE_HOST.test(hostOf(url))) return undefined;

  return url.match(/\/folders\/([\w-]+)/)?.[1];
}

export const driveFileUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`;

// canva.com/design/<id>/<token>/... -> the public view link Canva's oEmbed accepts.
export function canvaViewUrl(url: string): string | undefined {
  const m = url.match(/canva\.com\/design\/([\w-]+)\/([\w-]+)/);

  return m ? `https://www.canva.com/design/${m[1]}/${m[2]}/view` : undefined;
}
