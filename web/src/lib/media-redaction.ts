import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

const MODEL = "claude-opus-5";

export type RedactionResult = {
  attempted: boolean;
  regionsFound: number;
  error?: string;
};

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// EXPERIMENTAL, best-effort only — see CLAUDE.md §18. Uses Claude's vision
// input to spot an apparent business logo or visible contact info (phone,
// email, URL, a business name printed on packaging/signage) in an uploaded
// listing photo, then blacks out the reported regions with sharp.
//
// This is NOT a guarantee. A missed detection leaves the original
// logo/contact info fully visible to the retailer on the other side of the
// blind-marketplace boundary — the one thing this app's core anonymization
// promise depends on. Sellers remain responsible for not uploading photos
// that show their own identity; this is a second layer, not the only one.
// Falls back to a no-op (never blocks the upload) if ANTHROPIC_API_KEY isn't
// configured, same posture as lib/ai-listing.ts.
export async function attemptRedaction(
  absoluteFilePath: string,
  mimeType: string
): Promise<RedactionResult> {
  if (!SUPPORTED_MEDIA_TYPES.includes(mimeType)) {
    return { attempted: false, regionsFound: 0 };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { attempted: false, regionsFound: 0, error: "ANTHROPIC_API_KEY not configured" };
  }

  try {
    const original = await sharp(absoluteFilePath).toBuffer();
    const meta = await sharp(original).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (!width || !height) {
      return { attempted: false, regionsFound: 0, error: "Couldn't read image dimensions" };
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system:
        'You detect regions in a photo that show a business logo, or visible contact information ' +
        '(phone number, email address, website URL, or a business name printed/stamped on packaging, ' +
        'a sign, or a watermark). Output ONLY a JSON array, no prose, no markdown fences. Each element: ' +
        '{"x": number, "y": number, "w": number, "h": number} — all normalized 0-1 fractions of image ' +
        "width/height, describing a bounding box loose enough to fully cover the detected element with " +
        "a small margin. Output an empty array if nothing is found. Never invent a region that isn't " +
        "actually visible in the image.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: original.toString("base64"),
              },
            },
            { type: "text", text: "Find any business logo or visible contact information in this photo." },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "[]";
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) return { attempted: true, regionsFound: 0 };

    let regions: { x: number; y: number; w: number; h: number }[];
    try {
      regions = JSON.parse(text.slice(start, end + 1));
    } catch {
      return { attempted: true, regionsFound: 0, error: "Couldn't parse detection response" };
    }
    if (!Array.isArray(regions) || regions.length === 0) {
      return { attempted: true, regionsFound: 0 };
    }

    const composites = regions
      .filter(
        (r) =>
          r && [r.x, r.y, r.w, r.h].every((n) => typeof n === "number" && n >= 0 && n <= 1)
      )
      .map((r) => {
        const left = Math.max(0, Math.min(width - 1, Math.round(r.x * width)));
        const top = Math.max(0, Math.min(height - 1, Math.round(r.y * height)));
        const boxW = Math.max(1, Math.min(width - left, Math.round(r.w * width)));
        const boxH = Math.max(1, Math.min(height - top, Math.round(r.h * height)));
        return {
          input: {
            create: {
              width: boxW,
              height: boxH,
              channels: 4 as const,
              background: { r: 0, g: 0, b: 0, alpha: 1 },
            },
          },
          left,
          top,
        };
      });

    if (composites.length === 0) return { attempted: true, regionsFound: 0 };

    const redactedBuffer = await sharp(original).composite(composites).toBuffer();
    await sharp(redactedBuffer).toFile(absoluteFilePath);

    return { attempted: true, regionsFound: composites.length };
  } catch (err) {
    return {
      attempted: true,
      regionsFound: 0,
      error: err instanceof Error ? err.message : "Redaction failed",
    };
  }
}
