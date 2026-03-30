import { Sidebar } from "@/components/Sidebar";
import Script from "next/script";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col lg:flex-row">
      <Sidebar />
      <main className="flex-1 lg:pl-56 overflow-auto">
        {/* Banner area riservata admin */}
        <div className="px-6 py-2 flex items-center gap-2 text-xs font-medium"
          style={{ backgroundColor: "rgba(248,113,113,0.08)", borderBottom: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
          <span>🛡</span>
          <span>Area Amministrazione — visibile solo agli admin</span>
        </div>
        <div className="p-6">{children}</div>
      </main>
      <Script src="https://app.ai-chat.it/scripts/widget.js" data-ai-chat-id="widget" strategy="afterInteractive" />
      <Script id="ai-chat-init" strategy="afterInteractive">
        {`document.addEventListener("AIChatLoaded", function() { initializeAIChat('0be46534-e033-4b2f-8f0c-2cde83c1b6fe'); });`}
      </Script>
    </div>
  );
}
