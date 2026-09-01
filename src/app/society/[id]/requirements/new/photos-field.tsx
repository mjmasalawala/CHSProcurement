"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { deleteUploadedRequirementPhoto } from "../actions";
import { MAX_REQUIREMENT_PHOTOS, MAX_REQUIREMENT_PHOTO_BYTES } from "@/lib/requirement-photos";

interface Props {
  societyId: string;
  value: string[];
  onChange: (urls: string[]) => void;
}

// No `capture` attribute on purpose — with `accept="image/*" multiple`,
// mobile browsers already offer both "Take Photo" and "Photo Library" in
// one native picker with multi-select; adding `capture` forces camera-only
// and drops multi-select on several browsers.
export function RequirementPhotosField({ societyId, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const remaining = MAX_REQUIREMENT_PHOTOS - value.length;
    if (remaining <= 0) {
      setError(`Up to ${MAX_REQUIREMENT_PHOTOS} photos are allowed.`);
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      setError(`Only ${remaining} more photo${remaining === 1 ? "" : "s"} can be added (max ${MAX_REQUIREMENT_PHOTOS}).`);
    }

    const oversized = selected.find((f) => f.size > MAX_REQUIREMENT_PHOTO_BYTES);
    if (oversized) {
      setError(`"${oversized.name}" is over 3MB — please use a smaller photo.`);
      return;
    }

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        selected.map((file) => {
          // Storage pathname, not the display name — built from the file's
          // extension only so spaces/unicode/special characters in the
          // original filename (e.g. a Mac screenshot's "Screenshot 2026-08-05
          // at 9.44.55 PM.png") can never cause an encoding mismatch between
          // the client-token request and the upload request.
          const dot = file.name.lastIndexOf(".");
          const ext = dot >= 0 ? file.name.slice(dot) : "";
          return upload(`requirement-photos/${societyId}/${crypto.randomUUID()}${ext}`, file, {
            access: "public",
            handleUploadUrl: "/api/requirement-photos/upload",
            clientPayload: societyId,
          });
        }),
      );
      onChange([...value, ...uploaded.map((b) => b.url)]);
    } catch (err) {
      console.error("Requirement photo upload failed:", err);
      setError(err instanceof Error ? err.message : "Upload failed — please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove(url: string) {
    setRemoving(url);
    setError(null);
    try {
      await deleteUploadedRequirementPhoto(societyId, url);
      onChange(value.filter((u) => u !== url));
    } catch {
      setError("Couldn't remove that photo — please try again.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {value.map((url) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-border-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                disabled={removing === url}
                aria-label="Remove photo"
                className="absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-[18px] text-white transition-opacity hover:bg-black/80 disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {value.length < MAX_REQUIREMENT_PHOTOS && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            id="requirement-photos-input"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <Button
            type="button"
            variant="secondary"
            className="border-accent-primary text-accent-primary hover:bg-accent-subtle"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Add photos"}
          </Button>
        </div>
      )}

      {error && <p className="text-[13px] text-status-error">{error}</p>}
      <p className="text-[13px] text-text-secondary">
        Up to {MAX_REQUIREMENT_PHOTOS} photos, 3MB each — helps vendors quote accurately without a site visit.
      </p>
    </div>
  );
}
