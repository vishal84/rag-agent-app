"use client";

import { useCallback, useEffect, useState } from "react";
import { getDocuments, getIngestStatus, triggerIngest } from "@/lib/api";
import type { DocumentSummary, IngestStatus } from "@/types/chat";

// Owned by AppShell so the permanent sidebar and the drawer render the same
// state from one set of requests instead of fetching independently.
export function useDocumentIndex() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setDocuments(await getDocuments());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents.");
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await getIngestStatus());
    } catch {
      // status is best-effort; ignore failures here
    }
  }, []);

  useEffect(() => {
    loadDocuments();
    loadStatus();
  }, [loadDocuments, loadStatus]);

  const ingest = useCallback(async () => {
    setIngesting(true);
    try {
      await triggerIngest();
      await Promise.all([loadDocuments(), loadStatus()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger ingest.");
    } finally {
      setIngesting(false);
    }
  }, [loadDocuments, loadStatus]);

  return { documents, status, ingesting, error, ingest };
}
