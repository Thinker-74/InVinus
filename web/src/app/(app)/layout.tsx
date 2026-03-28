import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col lg:flex-row">
      <Sidebar />
      {/* Content area — offset by sidebar width on desktop */}
      <main className="flex-1 lg:pl-56 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
