"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard" },
  { href: "/team",         label: "Team" },
  { href: "/catalogo",     label: "Catalogo" },
  { href: "/consulenti",   label: "Consulenti" },
  { href: "/clienti",      label: "Clienti" },
  { href: "/ordini",             label: "Ordini" },
  { href: "/provvigioni",        label: "Provvigioni" },
  { href: "/referral/gestisci",  label: "Referral" },
  { href: "/eventi",             label: "Eventi" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor: active ? "var(--color-ash)" : "transparent",
              color: active ? "var(--color-gold)" : "var(--color-muted)",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active ? "var(--color-gold)" : "var(--color-ash)" }} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserFooter() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="p-4" style={{ borderTop: "1px solid var(--color-border)" }}>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs truncate" style={{ color: "var(--color-muted)" }}>Account</p>
          <p className="text-sm font-medium truncate" style={{ color: "var(--color-pearl)" }}>InVinus</p>
        </div>
        <button
          onClick={handleLogout}
          className="ml-2 rounded-lg px-2 py-1 text-xs transition-opacity hover:opacity-80"
          style={{ color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
          title="Esci"
        >
          Esci
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const Logo = () => (
    <span
      className="text-xl font-bold tracking-wide"
      style={{ fontFamily: "var(--font-playfair)", color: "var(--color-gold)" }}
    >
      InVinus
    </span>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex lg:flex-col lg:w-56 lg:fixed lg:inset-y-0"
        style={{ backgroundColor: "var(--color-smoke)", borderRight: "1px solid var(--color-border)" }}
      >
        <div className="flex h-16 items-center px-6" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <Logo />
        </div>
        <NavLinks />
        <UserFooter />
      </aside>

      {/* Mobile header */}
      <header
        className="lg:hidden flex items-center justify-between px-4 h-14"
        style={{ backgroundColor: "var(--color-smoke)", borderBottom: "1px solid var(--color-border)" }}
      >
        <Logo />
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2"
          style={{ color: "var(--color-pearl)" }}
          aria-label="Apri menu"
        >
          ☰
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="relative flex flex-col w-64 h-full"
            style={{ backgroundColor: "var(--color-smoke)" }}
          >
            <div className="flex items-center justify-between px-6 h-14" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <Logo />
              <button onClick={() => setMobileOpen(false)} style={{ color: "var(--color-muted)" }}>✕</button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <UserFooter />
          </aside>
        </div>
      )}
    </>
  );
}
