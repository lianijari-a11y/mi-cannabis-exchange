import "server-only";
import { put } from "@vercel/blob";
import path from "path";
import { attemptRedaction } from "@/lib/media-redaction";

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

export async function saveMediaFile(
  listingId: string,
  file: File
): Promise<{
  url: string;
  type: "image" | "video";
  redactionAttempted: boolean;
  redactionRegionsFound: number;
  redactionError?: string;
}> {
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) {
    throw new Error(`Unsupported media type: ${file.type || "unknown"}`);
  }

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());

  // Best-effort logo/contact-info redaction — images only, never blocks the
  // upload on failure. See lib/media-redaction.ts for the honest limits.
  // Operates on the in-memory buffer now (no local file to read/overwrite
  // once uploads go straight to Blob storage) and hands back whichever
  // buffer should actually be uploaded.
  let redaction: Omit<Awaited<ReturnType<typeof attemptRedaction>>, "buffer"> = {
    attempted: false,
    regionsFound: 0,
  };
  if (isImage) {
    const result = await attemptRedaction(buffer, file.type);
    buffer = result.buffer;
    redaction = { attempted: result.attempted, regionsFound: result.regionsFound, error: result.error };
  }

  const url = await uploadToBlob(listingId, file, buffer, isVideo ? ".mp4" : ".jpg");

  return {
    url,
    type: isVideo ? "video" : "image",
    redactionAttempted: redaction.attempted,
    redactionRegionsFound: redaction.regionsFound,
    redactionError: redaction.error,
  };
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
