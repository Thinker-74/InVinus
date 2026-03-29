import { Sidebar } from "@/components/Sidebar";
import Script from "next/script";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col lg:flex-row">
      <Sidebar />
      {/* Content area — offset by sidebar width on desktop */}
      <main className="flex-1 lg:pl-56 overflow-auto">
        <div className="p-6">{children}</div>
      </main>

      {/* Botticello — widget chat AI InVinus */}
      <Script
        src="https://app.ai-chat.it/scripts/widget.js"
        data-ai-chat-id="widget"
        strategy="afterInteractive"
      />
      <Script id="ai-chat-init" strategy="afterInteractive">
        {`document.addEventListener("AIChatLoaded", function() {
          initializeAIChat('0be46534-e033-4b2f-8f0c-2cde83c1b6fe');
        });`}
      </Script>
    </div>
  );
}
