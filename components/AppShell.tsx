"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatWindow from "@/components/ChatWindow";
import DocumentSidebar from "@/components/DocumentSidebar";
import Icon from "@/components/Icon";
import { useDismissable } from "@/lib/useDismissable";

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Seeded after mount so it agrees with the pre-hydration theme script.
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  useDismissable(closeDrawer, drawerOpen);

  useEffect(() => {
    if (!drawerOpen) return;
    const trigger = (document.activeElement as HTMLElement | null) ?? menuButtonRef.current;
    drawerRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      trigger?.focus();
    };
  }, [drawerOpen]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // private mode / blocked storage: the toggle still applies for this session
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <header className="flex shrink-0 items-center gap-1 bg-surface px-2 py-2 medium:px-4">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open documents"
          aria-expanded={drawerOpen}
          className="state-layer focus-ring flex h-12 w-12 items-center justify-center rounded-full text-on-surface-variant expanded:hidden"
        >
          <Icon name="menu" size={24} />
        </button>
        <h1 className="truncate px-2 text-title-large text-on-surface">RAG Agent Chat</h1>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          className="state-layer focus-ring ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-on-surface-variant"
        >
          <Icon name={isDark ? "light_mode" : "dark_mode"} size={24} />
        </button>
      </header>

      <div className="mx-auto flex w-full min-h-0 flex-1 gap-0 expanded:max-w-6xl expanded:gap-4 expanded:px-4 expanded:pb-4">
        <aside className="hidden shrink-0 expanded:block expanded:w-80">
          <DocumentSidebar />
        </aside>

        <main className="min-w-0 flex-1">
          <ChatWindow />
        </main>
      </div>

      {drawerOpen && (
        <div className="expanded:hidden">
          <div
            className="fixed inset-0 z-40 animate-fade-in bg-scrim/40 motion-reduce:animate-none"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Documents"
            className="fixed inset-y-0 left-0 z-50 w-80 max-w-[80vw] animate-drawer-in overflow-hidden rounded-r-lg shadow-elevation-1 outline-none motion-reduce:animate-none"
          >
            <DocumentSidebar onNavigate={closeDrawer} />
          </div>
        </div>
      )}
    </div>
  );
}
