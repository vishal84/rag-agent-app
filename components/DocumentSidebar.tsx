"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { getDocuments, getIngestStatus, triggerIngest } from "@/lib/api";
import type { DocumentSummary, IngestStatus } from "@/types/chat";

interface DocumentSidebarProps {
  onNavigate?: () => void;
}

export default function DocumentSidebar({ onNavigate }: DocumentSidebarProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDocuments() {
    try {
      const docs = await getDocuments();
      setDocuments(docs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents.");
    }
  }

  async function loadStatus() {
    try {
      const s = await getIngestStatus();
      setStatus(s);
    } catch {
      // status is best-effort; ignore failures here
    }
  }

  useEffect(() => {
    loadDocuments();
    loadStatus();
  }, []);

  async function handleIngest() {
    setIngesting(true);
    try {
      await triggerIngest();
      await Promise.all([loadDocuments(), loadStatus()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger ingest.");
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-surface-container-low p-4 medium:rounded-lg">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title-medium text-on-surface">Documents</h2>
        <button
          type="button"
          onClick={handleIngest}
          disabled={ingesting}
          className="state-layer focus-ring flex items-center gap-1.5 rounded-full bg-secondary-container px-4 py-2 text-label-large text-on-secondary-container disabled:bg-on-surface/[0.12] disabled:text-on-surface/[0.38]"
        >
          <Icon
            name="refresh"
            size={18}
            className={ingesting ? "animate-spin motion-reduce:animate-none" : ""}
          />
          Re-ingest
        </button>
      </div>

      {status && (
        <div className="mt-3 rounded-sm bg-surface-container px-3 py-2 text-body-small text-on-surface-variant">
          <p>Status: {status.status}</p>
          <p>
            Indexed: {status.documents_processed} docs / {status.chunks_upserted} chunks
          </p>
          {status.last_run_at && <p>Last run: {new Date(status.last_run_at).toLocaleString()}</p>}
          {status.error && (
            <p className="mt-1 break-words text-on-error-container">{status.error}</p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-sm bg-error-container px-3 py-2 text-body-small text-on-error-container">
          {error}
        </p>
      )}

      <ul className="mt-3 flex-1 space-y-1 overflow-y-auto">
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
