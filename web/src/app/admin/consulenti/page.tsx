"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Consulente = {
  id: number; nome: string; cognome: string; status: string; ruolo: string;
  pv_mese: number; gv_mese: number;
  sponsor_nome: string | null; sponsor_cognome: string | null;
  data_iscrizione: string | null; attivo: boolean;
};

const STATUS_LIST = ["STARTER","APPRENTICE","ADVISOR","SUPERVISOR","TEAM_COORDINATOR","MANAGER","DIRECTOR","AMBASSADOR","GOLDEN"];

const STATUS_COLOR: Record<string, string> = {
  STARTER: "#6b7280", APPRENTICE: "#3b82f6", ADVISOR: "#8b5cf6",
  SUPERVISOR: "#f59e0b", TEAM_COORDINATOR: "#f97316",
  MANAGER: "#ef4444", DIRECTOR: "#22c55e", AMBASSADOR: "#ec4899", GOLDEN: "#C8A85C",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminConsulentiPage() {
  const [dati, setDati]           = useState<Consulente[]>([]);
  const [filtroStatus, setFiltro] = useState("tutti");
  const [loading, setLoading]     = useState(true);
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    const supabase = createClient();
    supabase.rpc("get_admin_consulenti", { p_anno: now.getFullYear(), p_mese: now.getMonth() + 1 })
      .then(({ data }) => { setDati((data as Consulente[]) ?? []); setLoading(false); });
  }, []);

  const filtrati = filtroStatus === "tutti"
    ? dati
    : dati.filter((c) => filtroStatus === "attivi" ? c.attivo : filtroStatus === "inattivi" ? !c.attivo : c.status === filtroStatus);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}>
          Rete Consulenti
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          {dati.length} consulenti totali · {dati.filter((c) => c.attivo).length} attivi questo mese
        </p>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap gap-2">
        {["tutti", "attivi", "inattivi", ...STATUS_LIST].map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            style={{
              backgroundColor: filtroStatus === f ? "var(--color-gold)" : "var(--color-ash)",
              color: filtroStatus === f ? "var(--color-ink)" : "var(--color-muted)",
            }}
          >
            {f === "tutti" ? `Tutti (${dati.length})` :
             f === "attivi" ? `Attivi (${dati.filter((c) => c.attivo).length})` :
             f === "inattivi" ? `Inattivi (${dati.filter((c) => !c.attivo).length})` :
             `${f} (${dati.filter((c) => c.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Tabella */}
      {loading ? (
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>Caricamento...</p>
      ) : filtrati.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>Nessun consulente trovato.</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
          {/* Header */}
          <div className="hidden lg:grid gap-3 px-4 py-2 text-xs font-medium"
            style={{ gridTemplateColumns: "1fr 6rem 4rem 4rem 1fr 6rem", backgroundColor: "var(--color-ash)", color: "var(--color-muted)" }}>
            <span>Consulente</span><span>Status</span><span className="text-right">PV</span>
            <span className="text-right">GV</span><span>Sponsor</span><span>Iscritto</span>
          </div>

          {filtrati.map((c, i) => (
            <div
              key={c.id}
              onClick={() => router.push(`/admin/consulenti/${c.id}`)}
              className="grid grid-cols-2 lg:grid gap-2 lg:gap-3 px-4 py-3 text-sm cursor-pointer hover:opacity-80 transition-opacity"
              style={{
                gridTemplateColumns: "1fr 6rem 4rem 4rem 1fr 6rem",
                backgroundColor: i % 2 === 0 ? "var(--color-surface)" : "var(--color-smoke)",
                borderTop: i > 0 ? "1px solid var(--color-border)" : undefined,
              }}
            >
              {/* Nome */}
              <div className="flex items-center gap-2 col-span-2 lg:col-span-1">
                <span style={{ color: "var(--color-pearl)", fontWeight: 500 }}>{c.nome} {c.cognome}</span>
                {c.ruolo === "admin" && (
                  <span className="text-xs px-1.5 rounded" style={{ backgroundColor: "rgba(200,168,92,0.2)", color: "var(--color-gold)" }}>admin</span>
                )}
                <span className="text-xs rounded-full px-1.5 py-0.5" style={{
                  backgroundColor: c.attivo ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                  color: c.attivo ? "#22c55e" : "#ef4444",
                }}>
                  {c.attivo ? "attivo" : "inattivo"}
                </span>
              </div>
              {/* Status */}
              <div className="hidden lg:flex items-center">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
                  backgroundColor: `${STATUS_COLOR[c.status]}22`,
                  color: STATUS_COLOR[c.status] ?? "var(--color-muted)",
                }}>
                  {c.status}
                </span>
              </div>
              {/* PV / GV */}
              <div className="hidden lg:block text-right" style={{ color: "var(--color-pearl)" }}>{Number(c.pv_mese).toFixed(0)}</div>
              <div className="hidden lg:block text-right" style={{ color: "var(--color-muted)" }}>{Number(c.gv_mese).toFixed(0)}</div>
              {/* Sponsor */}
              <div className="hidden lg:block text-xs" style={{ color: "var(--color-muted)" }}>
                {c.sponsor_nome ? `${c.sponsor_nome} ${c.sponsor_cognome}` : "—"}
              </div>
              {/* Data */}
              <div className="hidden lg:block text-xs" style={{ color: "var(--color-muted)" }}>
                {formatDate(c.data_iscrizione)}
              </div>
              {/* Mobile summary */}
              <div className="lg:hidden text-xs" style={{ color: "var(--color-muted)" }}>
                {c.status} · PV {Number(c.pv_mese).toFixed(0)} · GV {Number(c.gv_mese).toFixed(0)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
