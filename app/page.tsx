import ChatWindow from "@/components/ChatWindow";
import DocumentSidebar from "@/components/DocumentSidebar";

export default function Home() {
  return (
    <main className="mx-auto flex h-screen max-w-6xl gap-4 p-4">
      <div className="w-72 shrink-0">
        <DocumentSidebar />
      </div>
      <div className="min-w-0 flex-1">
        <ChatWindow />
      </div>
    </main>
  );
}
