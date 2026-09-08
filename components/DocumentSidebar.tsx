"use client";

import { useEffect, useState } from "react";
import { RefreshCw, FileText } from "lucide-react";
import { getDocuments, getIngestStatus, triggerIngest } from "@/lib/api";
import type { DocumentSummary, IngestStatus } from "@/types/chat";

export default function DocumentSidebar() {
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
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Documents</h2>
        <button
          type="button"
          onClick={handleIngest}
          disabled={ingesting}
          className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={ingesting ? "animate-spin" : ""} />
          Re-ingest
        </button>
      </div>

      {status && (
        <div className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
          <p>Status: {status.status}</p>
          <p>
            Indexed: {status.documents_processed} docs / {status.chunks_upserted} chunks
          </p>
          {status.last_run_at && <p>Last run: {new Date(status.last_run_at).toLocaleString()}</p>}
          {status.error && <p className="mt-1 break-words text-red-600">{status.error}</p>}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <ul className="mt-3 flex-1 space-y-1 overflow-y-auto">
        {documents.map((doc) => (
          <li
            key={doc.file_id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            <FileText size={14} className="shrink-0 text-slate-400" />
            <span className="truncate" title={doc.doc_name}>
              {doc.doc_name}
            </span>
            <span className="ml-auto shrink-0 text-slate-400">{doc.page_count}p</span>
          </li>
        ))}
        {documents.length === 0 && !error && (
          <li className="px-2 py-1.5 text-xs text-slate-400">No documents indexed yet.</li>
        )}
      </ul>
    </div>
  );
}
