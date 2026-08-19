import "server-only";
import { put, del } from "@vercel/blob";
import path from "path";
import { attemptRedaction } from "@/lib/media-redaction";

// Every listing-media form now uploads files client-direct-to-Blob before
// submitting (see components/seller/listing-form.tsx / edit-listing-form.tsx)
// and carries the result as a single JSON-encoded `mediaUploads` field
// instead of raw File objects — this is the one place that parses it back
// out, so the shape can't drift between the create and edit call sites.
export function parseMediaUploadsField(formData: FormData): { url: string; contentType: string }[] {
  const raw = formData.get("mediaUploads");
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m): m is { url: unknown; contentType: unknown } => m && typeof m === "object")
      .map((m) => ({ url: String(m.url ?? ""), contentType: String(m.contentType ?? "") }))
      .filter((m) => m.url);
  } catch {
    return [];
  }
}

// Vercel Blob Storage — swapped in from local disk (CLAUDE.md §7/§8's old
// "dev only, swap before production" note) after uploads started failing
// outright on the deployed app: Vercel's serverless filesystem is
// read-only outside a short-lived temp dir, so writeFile() to
// public/uploads/ never actually persisted anything in production. Public
// access (not signed/private) matches how these URLs were already used
// throughout the app — embedded directly in <img>/<video> src, no
// per-request auth check on the file itself, same as the old static
// /uploads/ serving.
async function uploadToBlob(key: string, file: File, buffer: Buffer, defaultExt: string): Promise<string> {
  const ext = path.extname(file.name) || defaultExt;
  const pathname = `${key}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: file.type || undefined,
  });
  return blob.url;
}

// Invoices and proof-of-delivery photos — image or PDF, unlike listing media
// which is image/video for the retailer feed.
export async function saveDocumentFile(key: string, file: File): Promise<string> {
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) {
    throw new Error(`Unsupported document type: ${file.type || "unknown"}`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadToBlob(key, file, buffer, isPdf ? ".pdf" : ".jpg");
}

// The other half of client-direct upload (see /api/blob-upload) — the
// browser already uploaded the raw file straight to Blob storage, so this
// only ever handles a small URL string, never file bytes, which is what
// lets a real video clear a Server Action's body-size cap at all. Images
// still get the same best-effort redaction pass as before: fetching the
// blob back down is an outbound GET a server function makes freely (not
// subject to bodySizeLimit, which only governs an *incoming* request
// body), and if a region is found, the redacted version is uploaded to a
// fresh blob and the original is deleted.
export async function finalizeUploadedMedia(
  blobUrl: string,
  contentType: string
): Promise<{
  url: string;
  type: "image" | "video";
  redactionAttempted: boolean;
  redactionRegionsFound: number;
  redactionError?: string;
}> {
  const isVideo = contentType.startsWith("video/");
  const isImage = contentType.startsWith("image/");
  if (!isVideo && !isImage) {
    throw new Error(`Unsupported media type: ${contentType || "unknown"}`);
  }

  if (!isImage) {
    return { url: blobUrl, type: "video", redactionAttempted: false, redactionRegionsFound: 0 };
  }

  const response = await fetch(blobUrl);
  if (!response.ok) {
    throw new Error("Couldn't retrieve the uploaded file.");
  }
  const original = Buffer.from(await response.arrayBuffer());
  const result = await attemptRedaction(original, contentType);

  let finalUrl = blobUrl;
  if (result.regionsFound > 0) {
    const ext = path.extname(new URL(blobUrl).pathname) || ".jpg";
    const pathname = `redacted/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const redactedBlob = await put(pathname, result.buffer, { access: "public", contentType });
    finalUrl = redactedBlob.url;
    await del(blobUrl).catch(() => {
      // Best-effort cleanup of the now-superseded unredacted upload —
      // never blocks on it, the redacted URL is already what matters.
    });
  }

  return {
    url: finalUrl,
    type: "image",
    redactionAttempted: result.attempted,
    redactionRegionsFound: result.regionsFound,
    redactionError: result.error,
  };
}
