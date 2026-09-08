"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { Citation } from "@/types/chat";

interface PdfPreviewModalProps {
  citation: Citation;
  onClose: () => void;
}

export default function PdfPreviewModal({ citation, onClose }: PdfPreviewModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${citation.doc_name}, page ${citation.page_number}`}
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="truncate text-sm font-medium text-slate-800">
            {citation.doc_name} &middot; p. {citation.page_number}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={20} />
          </button>
        </div>
        <iframe
          src={citation.drive_url}
          title={`${citation.doc_name} page ${citation.page_number}`}
          className="h-full w-full flex-1 border-0"
        />
      </div>
    </div>
  );
}
