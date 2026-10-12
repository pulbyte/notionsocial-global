import {Schema} from "effect";

// Drive API v3 files.list, the fields media-links asks for.
export const DriveFile = Schema.Struct({id: Schema.String, name: Schema.String, mimeType: Schema.String});

export type DriveFile = typeof DriveFile.Type;

export const DriveFileList = Schema.Struct({files: Schema.Array(DriveFile)});

// Canva's oEmbed answer for a public design link.
export const CanvaEmbed = Schema.Struct({thumbnail_url: Schema.String});

// One GET: status, body as text and the URL after redirects.
export type HttpAnswer = {status: number; body: string; url: string};

export type HttpGet = (url: string) => Promise<HttpAnswer>;

// The catalogue entries (#51) a media link can fail with.
export type LinkErrorCode = "drive-restricted" | "canva-link";
