"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
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
        className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
      >
        <FileText size={12} />
        {citation.doc_name}, p. {citation.page_number}
      </button>
      {open && <PdfPreviewModal citation={citation} onClose={() => setOpen(false)} />}
    </>
  );
}
