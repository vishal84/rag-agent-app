"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
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
    <div className="flex h-full flex-col overflow-hidden bg-surface-container-low medium:rounded-lg">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-body-medium text-on-surface-variant">
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
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                message.role === "user"
                  ? "bg-primary text-on-primary"
                  : "bg-primary-container text-on-primary-container"
              }`}
            >
              <Icon name={message.role === "user" ? "person" : "smart_toy"} size={18} />
            </div>
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2.5 text-body-large medium:max-w-[75%] ${
                message.role === "user"
                  ? "rounded-br-xs bg-primary text-on-primary"
                  : "rounded-bl-xs bg-surface-container-high text-on-surface"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
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
        {loading && (
          <p className="flex items-center gap-2 text-body-medium text-on-surface-variant">
            <Icon name="progress_activity" size={18} className="animate-spin motion-reduce:animate-none" />
            Thinking...
          </p>
        )}
        {error && (
          <p className="rounded-sm bg-error-container px-3 py-2 text-body-medium text-on-error-container">
            {error}
          </p>
        )}
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-outline-variant p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <label htmlFor="chat-input" className="sr-only">
          Ask a question about your documents
        </label>
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={loading}
          className="focus-ring h-12 min-w-0 flex-1 rounded-full border border-outline bg-surface px-4 text-body-large text-on-surface placeholder:text-on-surface-variant disabled:bg-on-surface/[0.12] disabled:text-on-surface/[0.38]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="state-layer focus-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary shadow-elevation-1 hover:shadow-elevation-2 active:shadow-elevation-1 disabled:bg-on-surface/[0.12] disabled:text-on-surface/[0.38] disabled:shadow-elevation-0"
          aria-label="Send message"
        >
          <Icon name="send" size={24} />
        </button>
      </form>
    </div>
  );
}
