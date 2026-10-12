import {Schema} from "effect";
import {linkError} from "./errors";
import {hostOf} from "./links";
import {DriveFileList, type DriveFile, type HttpGet} from "./schema";

// Files a post can use; other entries in a folder (docs, sub-folders, text) are skipped.
const POSTABLE = /^(image|video)\/|^application\/pdf$/;

// No platform takes more files in one post (TikTok: 35).
const MAX_FOLDER_FILES = 35;

const decodeList = Schema.decodeUnknownOption(Schema.fromJsonString(DriveFileList));

const apiUrl = (id: string, key: string) =>
  `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${id}' in parents and trashed = false`)}` +
  `&fields=files(id,name,mimeType)&pageSize=100&key=${key}`;

const ENTRY = /<a href="https:\/\/drive\.google\.com\/file\/d\/([\w-]+)\/view[^"]*".*?\/type\/([\w.+/-]+)".*?flip-entry-title">([^<]*)</gs;

// The embedded folder page Drive shows for a public folder (used when no API key is set).
function parseFolderPage(html: string): DriveFile[] {
  return [...html.matchAll(ENTRY)].map((m) => ({id: m[1] ?? "", mimeType: m[2] ?? "", name: m[3] ?? ""}));
}

const byName = (a: DriveFile, b: DriveFile) => a.name.localeCompare(b.name, "en", {numeric: true});

// The postable files of a public Drive folder, by name (1.jpg, 2.jpg, ... 10.jpg).
export async function listDriveFolder(id: string, get: HttpGet, apiKey?: string): Promise<DriveFile[]> {
  const folderUrl = `https://drive.google.com/drive/folders/${id}`;
  const res = await get(apiKey ? apiUrl(id, apiKey) : `https://drive.google.com/embeddedfolderview?id=${id}`);

  // A private folder answers 404, or sends the page to Google's sign-in.
  if (res.status !== 200 || hostOf(res.url) === "accounts.google.com") throw linkError("drive-restricted", folderUrl);

  const listed = apiKey ? decodeList(res.body) : {_tag: "Some" as const, value: {files: parseFolderPage(res.body)}};

  if (listed._tag === "None") throw linkError("drive-restricted", folderUrl);

  return listed.value.files.filter((f) => POSTABLE.test(f.mimeType)).toSorted(byName).slice(0, MAX_FOLDER_FILES);
}
