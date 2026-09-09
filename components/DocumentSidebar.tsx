"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import type { DocumentSummary, IngestStatus } from "@/types/chat";

interface DocumentSidebarProps {
  documents: DocumentSummary[];
  status: IngestStatus | null;
  ingesting: boolean;
  error: string | null;
  onIngest: () => void;
  onNavigate?: () => void;
  header?: React.ReactNode;
}

function ErrorBlock({ message }: { message: string }) {
  const [expanded, setExpanded] = useState(false);
  const [summary, ...rest] = message.split(". ");
  const detail = rest.join(". ").trim();

  return (
    <div className="mt-3 rounded-sm bg-error-container px-3 py-2 text-body-small text-on-error-container">
      <p className="break-words">{summary.trim()}</p>
      {detail && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="focus-ring mt-1 rounded-xs underline underline-offset-2"
          >
            {expanded ? "Hide details" : "Show details"}
          </button>
          {expanded && <p className="mt-1 break-words opacity-80">{detail}</p>}
        </>
      )}
    </div>
  );
}

export default function DocumentSidebar({
  documents,
  status,
  ingesting,
  error,
  onIngest,
  onNavigate,
  header,
}: DocumentSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-surface-container-low p-4 medium:rounded-lg">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title-medium text-on-surface">Documents</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onIngest}
            disabled={ingesting}
            className="state-layer focus-ring flex items-center gap-1.5 rounded-full bg-secondary-container px-4 py-2 text-label-large text-on-secondary-container disabled:bg-on-surface/[0.12] disabled:text-on-surface/[0.38]"
          >
            <Icon
              name="refresh"
              size={20}
              className={ingesting ? "animate-spin motion-reduce:animate-none" : ""}
            />
            Re-ingest
          </button>
          {header}
        </div>
      </div>

      {status && (
        <div className="mt-3 rounded-sm bg-surface-container px-3 py-2 text-body-small text-on-surface-variant">
          <p>Status: {status.status}</p>
          <p>
            Indexed: {status.documents_processed} docs / {status.chunks_upserted} chunks
          </p>
          {status.last_run_at && <p>Last run: {new Date(status.last_run_at).toLocaleString()}</p>}
        </div>
      )}

      {status?.error && <ErrorBlock message={status.error} />}
      {error && <ErrorBlock message={error} />}

      <ul className="-mx-1 mt-3 flex-1 space-y-1 overflow-y-auto px-1">
        {documents.map((doc) => (
          <li key={doc.file_id}>
            <button
              type="button"
              onClick={onNavigate}
              className="state-layer focus-ring flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-left text-label-large text-on-surface-variant"
            >
              <Icon name="description" size={20} className="shrink-0" />
              <span className="truncate" title={doc.doc_name}>
                {doc.doc_name}
              </span>
              <span className="ml-auto shrink-0 text-body-small">{doc.page_count}p</span>
            </button>
          </li>
        ))}
        {documents.length === 0 && !error && (
          <li className="px-3 py-2.5 text-body-medium text-on-surface-variant">
            No documents indexed yet.
          </li>
        )}
      </ul>
    </div>
  );
}
