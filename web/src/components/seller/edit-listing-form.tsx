"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { CATEGORIES, CATEGORY_LABELS, TERMS, TERMS_LABELS, UNITS } from "@/lib/constants";

const inputClass =
  "w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent";
const labelClass = "text-xs text-gray-500 dark:text-gray-400";

type EditableListing = {
  id: string;
  strainName: string;
  category: string;
  thcPercent: number | null;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  terms: string;
  notes: string | null;
  minimumOrderQuantity: number | null;
  belowMinimumPricePerUnit: number | null;
  media: { id: string; url: string; type: string }[];
};

// Editing an already-posted, still-active listing — price/quantity/photos
// all need to change while a menu is selling, not just get a freshness
// bump. Shared by the seller's own listing detail page and the Sales
// Rep/Admin "edit a listing you posted for someone" pages, since the field
// set and media-management UI are identical either way — only the wiring
// (the `action` prop) differs per caller.
export function EditListingForm({
  listing,
  action,
  onCancel,
  error,
}: {
  listing: EditableListing;
  action: (formData: FormData) => void;
  onCancel?: () => void;
  error?: string;
}) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formRef.current) return;

    const formData = new FormData(formRef.current);

    if (newFiles.length > 0) {
      setUploading(true);
      setUploadProgress({ done: 0, total: newFiles.length });
      const media: { url: string; contentType: string }[] = [];
      for (const file of newFiles) {
        try {
          const blob = await upload(`listing-${listing.id}/${Date.now()}-${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/blob-upload",
          });
          media.push({ url: blob.url, contentType: blob.contentType ?? file.type });
        } catch {
          // One file failing to upload shouldn't block saving the rest of
          // the edit — it just saves with fewer new photos than selected.
        }
        setUploadProgress((p) => (p ? { done: p.done + 1, total: p.total } : null));
      }
      formData.set("mediaUploads", JSON.stringify(media));
      setUploading(false);
      setUploadProgress(null);
    }

    action(formData);
  }

  function toggleRemove(id: string) {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="listingId" value={listing.id} />

      <div>
        <label className={labelClass} htmlFor="edit-strainName">
          Strain / product name
        </label>
        <input
          id="edit-strainName"
          name="strainName"
          required
          defaultValue={listing.strainName}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="edit-category">
            Category
          </label>
          <select id="edit-category" name="category" defaultValue={listing.category} className={inputClass}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-thcPercent">
            THC %
          </label>
          <input
            id="edit-thcPercent"
            name="thcPercent"
            type="number"
            step="0.1"
            min="0"
            max="100"
            defaultValue={listing.thcPercent ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="edit-quantity">
            Quantity
          </label>
          <input
            id="edit-quantity"
            name="quantity"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={listing.quantity}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-unit">
            Unit
          </label>
          <select id="edit-unit" name="unit" defaultValue={listing.unit} className={inputClass}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u === "lb" ? "Pounds" : u === "liter" ? "Liters" : "Units"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="edit-pricePerUnit">
            Price per unit ($)
          </label>
          <input
            id="edit-pricePerUnit"
            name="pricePerUnit"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={listing.pricePerUnit}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-terms">
            Terms offered
          </label>
          <select id="edit-terms" name="terms" defaultValue={listing.terms} className={inputClass}>
            {TERMS.map((t) => (
              <option key={t} value={t}>
                {TERMS_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="edit-minimumOrderQuantity">
            Minimum order ({listing.unit}, optional)
          </label>
          <input
            id="edit-minimumOrderQuantity"
            name="minimumOrderQuantity"
            type="number"
            step="0.01"
            min="0"
            defaultValue={listing.minimumOrderQuantity ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-belowMinimumPricePerUnit">
            Price below minimum ($, optional)
          </label>
          <input
            id="edit-belowMinimumPricePerUnit"
            name="belowMinimumPricePerUnit"
            type="number"
            step="0.01"
            min="0"
            defaultValue={listing.belowMinimumPricePerUnit ?? ""}
            className={inputClass}
          />
        </div>
      </div>
      <p className="text-[11px] text-gray-400 -mt-2">
        Optional: charge a different (usually higher) per-unit price for orders smaller than your
        preferred minimum, instead of turning them away. Leave both blank to sell at the same price
        regardless of quantity.
      </p>

      <div>
        <label className={labelClass} htmlFor="edit-notes">
          Notes (optional)
        </label>
        <textarea
          id="edit-notes"
          name="notes"
          rows={3}
          defaultValue={listing.notes ?? ""}
          className={inputClass}
        />
      </div>

      {listing.media.length > 0 && (
        <div>
          <label className={labelClass}>Current photos / videos</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {listing.media.map((m) => {
              const marked = removedIds.has(m.id);
              return (
                <label
                  key={m.id}
                  className={`relative shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 ${
                    marked ? "border-red-500 opacity-40" : "border-transparent"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="removeMedia"
                    value={m.id}
                    checked={marked}
                    onChange={() => toggleRemove(m.id)}
                    className="sr-only"
                  />
                  {m.type === "video" ? (
                    <video src={m.url} className="h-24 w-24 object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" className="h-24 w-24 object-cover" />
                  )}
                  <span className="absolute bottom-0 inset-x-0 text-center text-[9px] bg-black/60 text-white py-0.5">
                    {marked ? "Will remove" : "Keep — click to remove"}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label className={labelClass} htmlFor="edit-media">
          Add photos / videos
        </label>
        <input
          id="edit-media"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))}
          className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-green-700 file:text-white file:px-3 file:py-1.5 file:text-xs`}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={uploading}
          className="bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {uploading
            ? uploadProgress
              ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…`
              : "Saving…"
            : "Save changes"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
