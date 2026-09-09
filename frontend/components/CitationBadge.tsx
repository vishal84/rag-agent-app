"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import type { Citation } from "@/types/chat";
import PdfPreviewModal from "@/components/PdfPreviewModal";

interface CitationBadgeProps {
  citation: Citation;
}

export default function CitationBadge({ citation }: CitationBadgeProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={citation.snippet}
        className="state-layer focus-ring inline-flex min-h-[32px] max-w-full items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1.5 text-label-medium text-on-secondary-container"
      >
        <Icon name="description" size={20} className="shrink-0" />
        <span className="truncate">
          {citation.doc_name}, p. {citation.page_number}
        </span>
      </button>
      {open && <PdfPreviewModal citation={citation} onClose={() => setOpen(false)} />}
    </>
  );
}
