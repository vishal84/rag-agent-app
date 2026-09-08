import type { ChatResponse, DocumentSummary, IngestStatus } from "@/types/chat";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function sendChatMessage(
  message: string,
  sessionId: string | null
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  return handleResponse<ChatResponse>(res);
}

export async function getDocuments(): Promise<DocumentSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/documents`);
  return handleResponse<DocumentSummary[]>(res);
}

export async function triggerIngest(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/ingest`, { method: "POST" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
  }
}

export async function getIngestStatus(): Promise<IngestStatus> {
  const res = await fetch(`${API_BASE_URL}/api/ingest/status`);
  return handleResponse<IngestStatus>(res);
}
