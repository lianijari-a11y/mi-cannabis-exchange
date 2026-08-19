"use client";

import { useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { Upload } from "lucide-react";

type ListingOption = { id: string; strainName: string };
type MatchResult =
  | { ok: true; matches: { filename: string; matchedStrainName: string | null }[] }
  | { ok: false; error: string };
type SaveResult = { ok: true; savedCount: number } | { ok: false; error: string };

// "What if I made a menu without pictures, I'd need a new way to upload
// pictures for menus that are already done" — a menu-level bulk uploader,
// separate from per-listing photo editing (EditListingForm already covers
// one listing at a time). Pick several photos at once, optionally let AI
// suggest which strain each filename belongs to (text-only match against
// the filename, not the image), review/override, then save. Same "draft,
// review, confirm" posture as every other AI-assisted step in this app —
// nothing uploads until the seller/AE explicitly saves.
//
// Each file uploads directly from the browser to Vercel Blob storage
// (`upload()`, authorized by /api/blob-upload) before `saveAction` is ever
// called — the Server Action only ever receives the resulting small URL
// strings, never raw file bytes. This is what lets a real video clear the
// platform's request-body ceiling at all; passing File objects straight
// into a Server Action (the old approach) tops out around 4MB on Vercel
// regardless of any app-level config.
export function BulkPhotoUpload({
  batchId,
  listings,
  matchAction,
  saveAction,
}: {
  batchId: string;
  listings: ListingOption[];
  matchAction: (filenames: string[], strainNames: string[]) => Promise<MatchResult>;
  saveAction: (
    batchId: string,
    assignments: { listingId: string; url: string; contentType: string }[]
  ) => Promise<SaveResult>;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [assignedTo, setAssignedTo] = useState<Record<number, string>>({});
  const [matching, startMatching] = useTransition();
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(e.target.files ?? []));
    setAssignedTo({});
    setResult(null);
    setMatchError(null);
  }

  function runMatch() {
    setMatchError(null);
    startMatching(async () => {
      const r = await matchAction(
        files.map((f) => f.name),
        listings.map((l) => l.strainName)
      );
      if (!r.ok) {
        setMatchError(r.error);
        return;
      }
      const nameToId = new Map(listings.map((l) => [l.strainName, l.id]));
      const next: Record<number, string> = {};
      r.matches.forEach((m, i) => {
        const id = m.matchedStrainName ? nameToId.get(m.matchedStrainName) : undefined;
        if (id) next[i] = id;
      });
      setAssignedTo(next);
    });
  }

  const assignedCount = Object.values(assignedTo).filter(Boolean).length;

  async function save() {
    const toUpload = files
      .map((file, i) => ({ file, listingId: assignedTo[i] }))
      .filter((a): a is { file: File; listingId: string } => !!a.listingId);
    if (toUpload.length === 0) return;

    setSaving(true);
    setResult(null);
    setUploadProgress({ done: 0, total: toUpload.length });

    const assignments: { listingId: string; url: string; contentType: string }[] = [];
    for (const { file, listingId } of toUpload) {
      try {
        const blob = await upload(`menu-${batchId}/${Date.now()}-${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/blob-upload",
        });
        assignments.push({ listingId, url: blob.url, contentType: blob.contentType ?? file.type });
      } catch {
        // One file failing to upload shouldn't block the rest — the
        // final savedCount from saveAction already tells the seller/AE
        // if fewer photos landed than they picked.
      }
      setUploadProgress((p) => (p ? { done: p.done + 1, total: p.total } : null));
    }

    if (assignments.length === 0) {
      setSaving(false);
      setUploadProgress(null);
      setResult({ ok: false, error: "Couldn't upload any of those files — try again." });
      return;
    }

    const r = await saveAction(batchId, assignments);
    setSaving(false);
    setUploadProgress(null);
    setResult(r);
    if (r.ok) {
      setFiles([]);
      setAssignedTo({});
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 text-[11px] text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900 rounded-full px-2 py-0.5 shrink-0"
      >
        <Upload className="w-3 h-3" /> Bulk add photos
      </button>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Bulk add photos to this menu</h4>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-400 underline">
          Close
        </button>
      </div>
      <input
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={pickFiles}
        className="text-xs text-gray-600 dark:text-gray-300"
      />
      {files.length > 0 && (
        <>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={runMatch}
              disabled={matching}
              className="text-xs border border-green-700 text-green-700 dark:text-green-400 rounded-full px-2.5 py-1 disabled:opacity-50"
            >
              {matching ? "Matching…" : "Match with AI"}
            </button>
            <span className="text-[11px] text-gray-400">
              Matches by filename (e.g. &quot;blue-dream-2.jpg&quot;) — always double-check below.
            </span>
          </div>
          {matchError && <p className="mt-1 text-xs text-amber-600">{matchError}</p>}
          <div className="mt-3 space-y-2">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate text-gray-600 dark:text-gray-300">{file.name}</span>
                <select
                  value={assignedTo[i] ?? ""}
                  onChange={(e) => setAssignedTo((a) => ({ ...a, [i]: e.target.value }))}
                  className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 bg-transparent"
                >
                  <option value="">Skip this photo</option>
                  {listings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.strainName}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving || assignedCount === 0}
            className="mt-3 bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {saving
              ? uploadProgress
                ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…`
                : "Saving…"
              : `Save ${assignedCount} photo${assignedCount === 1 ? "" : "s"}`}
          </button>
        </>
      )}
      {result && (
        <p className={`mt-2 text-xs ${result.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
          {result.ok ? `Saved ${result.savedCount} photo${result.savedCount === 1 ? "" : "s"}.` : result.error}
        </p>
      )}
    </div>
  );
}
