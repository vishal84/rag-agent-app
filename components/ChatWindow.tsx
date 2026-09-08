"use client";

import { useRef, useState } from "react";
import { Send, Bot, User } from "lucide-react";
import { sendChatMessage } from "@/lib/api";
import type { ChatMessage } from "@/types/chat";
import CitationBadge from "@/components/CitationBadge";

function newId() {
  return Math.random().toString(36).slice(2);
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionId = useRef<string>(newId());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { id: newId(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await sendChatMessage(trimmed, sessionId.current);
      const assistantMessage: ChatMessage = {
        id: newId(),
        role: "assistant",
        content: response.answer,
        citations: response.citations,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400">
            Ask a question about your ingested documents to get started.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-2 ${
              message.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                message.role === "user" ? "bg-slate-800 text-white" : "bg-blue-100 text-blue-700"
              }`}
            >
              {message.role === "user" ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                message.role === "user"
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-900"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.citations && message.citations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {message.citations.map((citation, idx) => (
                    <CitationBadge key={`${citation.file_id}-${citation.page_number}-${idx}`} citation={citation} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <p className="text-sm text-slate-400">Thinking...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={loading}
          className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-blue-400 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
