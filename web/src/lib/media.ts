import "server-only";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

// Local-disk storage for development only — see CLAUDE.md §8, swap for real
// object storage (S3/Supabase Storage/Cloudinary) before production.
async function writeUpload(key: string, file: File, defaultExt: string): Promise<string> {
  const dir = path.join(UPLOAD_ROOT, key);
  await mkdir(dir, { recursive: true });

  const ext = path.extname(file.name) || defaultExt;
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const filePath = path.join(dir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return `/uploads/${key}/${filename}`;
}

export async function saveMediaFile(
  listingId: string,
  file: File
): Promise<{ url: string; type: "image" | "video" }> {
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) {
    throw new Error(`Unsupported media type: ${file.type || "unknown"}`);
  }

  const url = await writeUpload(listingId, file, isVideo ? ".mp4" : ".jpg");
  return { url, type: isVideo ? "video" : "image" };
}

// Invoices and proof-of-delivery photos — image or PDF, unlike listing media
// which is image/video for the retailer feed.
export async function saveDocumentFile(key: string, file: File): Promise<string> {
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) {
    throw new Error(`Unsupported document type: ${file.type || "unknown"}`);
  }

  return writeUpload(key, file, isPdf ? ".pdf" : ".jpg");
}
