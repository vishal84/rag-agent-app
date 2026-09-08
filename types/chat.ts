export interface Citation {
  doc_name: string;
  file_id: string;
  drive_url: string;
  page_number: number;
  snippet: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

export interface DocumentSummary {
  doc_name: string;
  file_id: string;
  page_count: number;
}

export interface IngestStatus {
  status: string;
  documents_processed: number;
  chunks_upserted: number;
  last_run_at: string | null;
  error: string | null;
}
