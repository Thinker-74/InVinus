"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/dashboard",         label: "Dashboard" },
  { href: "/team",              label: "Team" },
  { href: "/catalogo",          label: "Catalogo" },
  { href: "/clienti",           label: "Clienti" },
  { href: "/ordini",            label: "Ordini" },
  { href: "/provvigioni",       label: "Provvigioni" },
  { href: "/referral/gestisci", label: "Referral" },
];

const ADMIN_ITEMS = [
  { href: "/admin/dashboard",   label: "Dashboard Admin" },
  { href: "/admin/consulenti",  label: "Gestione Consulenti" },
  { href: "/admin/candidature", label: "Candidature" },
  { href: "/admin/provvigioni", label: "Calcolo Provvigioni" },
];

type Profilo = { nome: string; cognome: string; ruolo: string };

function NavLinks({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin: boolean }) {
  const pathname = usePathname();

  function NavItem({ href, label, admin }: { href: string; label: string; admin?: boolean }) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
        style={{
          backgroundColor: active ? "var(--color-ash)" : "transparent",
          color: active
            ? admin ? "#f87171" : "var(--color-gold)"
            : admin ? "rgba(248,113,113,0.7)" : "var(--color-muted)",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
          style={{
            backgroundColor: active
              ? admin ? "#f87171" : "var(--color-gold)"
              : "var(--color-ash)",
          }}
        />
        {label}
      </Link>
    );
  }

  return (
    <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto">
      {NAV_ITEMS.map((item) => <NavItem key={item.href} {...item} />)}

      {isAdmin && (
        <>
          <div className="px-3 pt-5 pb-1 flex items-center gap-2">
            <span style={{ color: "#f87171", fontSize: "0.6rem" }}>🛡</span>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#f87171" }}>
              Amministrazione
            </p>
          </div>
          <div className="mx-1 rounded-lg py-1" style={{ backgroundColor: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.15)" }}>
            {ADMIN_ITEMS.map((item) => <NavItem key={item.href} {...item} admin />)}
          </div>
        </>
      )}
    </nav>
  );
}

function UserFooter({ profilo }: { profilo: Profilo | null }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isAdmin = profilo?.ruolo === "admin";

  return (
    <div className="p-4" style={{ borderTop: "1px solid var(--color-border)" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate" style={{ color: "var(--color-pearl)" }}>
              {profilo ? `${profilo.nome} ${profilo.cognome}` : "InVinus"}
            </p>
            {isAdmin && (
              <span
                className="flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "rgba(248,113,113,0.15)", color: "#f87171" }}
              >
                Admin
              </span>
            )}
          </div>
          <p className="text-xs truncate" style={{ color: "var(--color-muted)" }}>
            {isAdmin ? "Amministratore" : "Consulente"}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="ml-2 flex-shrink-0 rounded-lg px-2 py-1 text-xs transition-opacity hover:opacity-80"
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
  const [profilo, setProfilo]       = useState<Profilo | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("consulenti")
        .select("nome, cognome, ruolo")
        .eq("auth_user_id", user.id)
        .single()
        .then(({ data }) => { if (data) setProfilo(data as Profilo); });
    });
  }, []);

  const isAdmin = profilo?.ruolo === "admin";

  const Logo = () => (
    <span className="text-xl font-bold tracking-wide" style={{ fontFamily: "var(--font-playfair)", color: "var(--color-gold)" }}>
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
        <NavLinks isAdmin={isAdmin} />
        <UserFooter profilo={profilo} />
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
          <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-64 h-full" style={{ backgroundColor: "var(--color-smoke)" }}>
            <div className="flex items-center justify-between px-6 h-14" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <Logo />
              <button onClick={() => setMobileOpen(false)} style={{ color: "var(--color-muted)" }}>✕</button>
            </div>
            <NavLinks isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} />
            <UserFooter profilo={profilo} />
          </aside>
        </div>
      )}
    </>
  );
}
