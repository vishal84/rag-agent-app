import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAG Agent Chat",
  description: "Chat with your Google Drive documents, with page-level citations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900">{children}</body>
    </html>
  );
}
