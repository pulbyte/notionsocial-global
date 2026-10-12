import type {Media, ProcessedMediaRecord} from "../types";

// #65: post-process turns each page of a PDF into a JPEG and stores it as the processed media
// "<pdf refId>~p<n>". Publish puts those pages after the PDF; LinkedIn keeps the PDF itself.
const PAGE = "~p";

// The most pages one post takes (TikTok carousel: 35).
export const MAX_PDF_PAGES = 35;

export const pageRef = (refId: string, page: number) => `${refId}${PAGE}${page}`;

export const isPdf = (m: Pick<Media, "type" | "mimeType">) => m.type === "doc" && m.mimeType === "pdf";

const pageNumber = (refId: string, ref: string) => (ref.startsWith(refId + PAGE) ? Number(ref.slice(refId.length + PAGE.length)) : NaN);

const publicUrl = (bucket: string, path: string) => `https://storage.googleapis.com/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;

// The page images stored for one PDF, in page order; none until post-process has run.
function pdfPages(doc: Media, processed: readonly ProcessedMediaRecord[], bucket: string): Media[] {
  const pages = processed
    .flatMap((r) => {
      const n = pageNumber(doc.refId, r.ref_id);

      return Number.isInteger(n) && n > 0 ? [{r, n}] : [];
    })
    .toSorted((a, b) => a.n - b.n);

  return pages.flatMap(({r, n}) => {
    const t = r.transformations.find((x) => !x.platforms?.length) ?? r.transformations[0];
    const path = t?.src.type === "bucket" ? t.src.path : undefined;

    if (!t || !path) return [];

    const name = `${doc.name.replace(/\.pdf$/i, "")}-${n}.jpg`;

    return [{name, url: publicUrl(bucket, path), mimeType: "jpeg", contentType: "image/jpeg", size: t.metadata.size, type: "image", refId: r.ref_id, pageOf: doc.refId}];
  });
}

// Each PDF followed by its page images; other media unchanged.
export function withPdfPages(media: Media[], processed: readonly ProcessedMediaRecord[] | undefined, bucket: string): Media[] {
  return media.flatMap((m) => (isPdf(m) ? [m, ...pdfPages(m, processed ?? [], bucket)] : [m]));
}
