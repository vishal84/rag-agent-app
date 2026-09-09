"use client";

import Icon from "@/components/Icon";
import { useDismissable } from "@/lib/useDismissable";
import type { Citation } from "@/types/chat";

interface PdfPreviewModalProps {
  citation: Citation;
  onClose: () => void;
}

export default function PdfPreviewModal({ citation, onClose }: PdfPreviewModalProps) {
  useDismissable(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-0 medium:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${citation.doc_name}, page ${citation.page_number}`}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-surface-container-high shadow-elevation-3 medium:h-[85vh] medium:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <h2 className="truncate text-title-medium text-on-surface">
            {citation.doc_name} &middot; p. {citation.page_number}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="state-layer focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant"
          >
            <Icon name="close" size={24} />
          </button>
        </div>
        <iframe
          src={citation.drive_url}
          title={`${citation.doc_name} page ${citation.page_number}`}
          className="h-full w-full flex-1 border-0 bg-surface"
        />
      </div>
    </div>
  );
}
