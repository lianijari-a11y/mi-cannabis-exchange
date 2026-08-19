import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";

// Authorizes client-direct uploads to Vercel Blob — the browser uploads
// straight to Blob storage using a short-lived token this route issues,
// never routing the file bytes through a Server Action's request body
// (capped at 4MB, see next.config.ts). This is what makes real video
// uploads possible at all; the old "pass a File to a Server Action"
// pattern (lib/media.ts before this) could never support anything beyond
// that cap on Vercel regardless of how high bodySizeLimit was set.
//
// No role check beyond "is signed in" — every role that can reach an
// upload UI in this app (grower/processor/broker posting a listing,
// retailer/transporter uploading a POD, an AE/Admin acting on a seller's
// behalf) is already gated by its own page's requireRole/requirePosAccess;
// this endpoint only needs to keep a completely anonymous caller from
// getting a write token to the store, not re-implement every page's own
// authorization.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user) {
          throw new Error("Not authorized.");
        }
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "application/pdf",
          ],
          addRandomSuffix: true,
          // Generous ceiling for a real phone video — Blob itself has no
          // meaningful size limit for a public store; this is just a sane
          // guard against something absurd being uploaded.
          maximumSizeInBytes: 500 * 1024 * 1024,
        };
      },
      // No onUploadCompleted persistence step — this app follows up the
      // client-side upload() call with its own small server action (just
      // the resulting URL, not the file bytes) to attach the media to a
      // listing/deal/shipment. Relying on this webhook instead would only
      // reliably fire against a publicly reachable deployment, not local
      // dev, and this app needs uploads to work in both.
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload authorization failed." },
      { status: 400 }
    );
  }
}
