"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";

// Displays Requirement.attachmentUrls — society detail page shows this
// unconditionally, vendor detail page only once contactRevealedAt is set
// (photos can reveal the building/society identity, same as the address).
export function RequirementPhotoGallery({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (urls.length === 0) return null;

  return (
    <Card className="flex flex-col gap-2">
      <p className="text-[13px] font-medium text-text-primary">Photos</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {urls.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpen(url)}
            className="aspect-square overflow-hidden rounded-lg border border-border-subtle"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {open && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen(null)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </Card>
  );
}
