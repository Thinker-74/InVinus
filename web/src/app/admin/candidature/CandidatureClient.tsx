"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Candidatura = {
  id: number; nome: string; cognome: string; email: string;
  telefono: string | null; motivazione: string | null;
  sponsor_referral_code: string | null; stato: string;
  created_at: string; note_admin: string | null;
};

const STATO_COLOR: Record<string, string> = {
  in_attesa: "var(--color-gold)",
  approvata: "#22c55e",
  rifiutata: "#ef4444",
};
const STATO_LABEL: Record<string, string> = {
  in_attesa: "In attesa", approvata: "Approvata", rifiutata: "Rifiutata",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CandidaturaCard({ c, onUpdate }: { c: Candidatura; onUpdate: () => void }) {
  const [expanded, setExpanded]     = useState(false);
  const [nota, setNota]             = useState(c.note_admin ?? "");
  const [isPending, startTransition] = useTransition();
  const [errore, setErrore]         = useState("");
  const router = useRouter();

  async function approva() {
    setErrore("");
    startTransition(async () => {
      const supabase = createClient();
      // Trova sponsor_id dal referral code
      let sponsorId: number | null = null;
      if (c.sponsor_referral_code) {
        const { data } = await supabase.rpc("get_incaricato_by_referral", { p_code: c.sponsor_referral_code });
        sponsorId = data?.[0]?.id ?? null;
      }
      // Crea incaricato con status STARTER
      const { error } = await supabase.from("incaricati").insert({
        nome:            c.nome,
        cognome:         c.cognome,
        email:           c.email,
        telefono:        c.telefono,
        sponsor_id:      sponsorId,
        status:          "STARTER",
        status_max:      "STARTER",
        attivo:          false,
        formazione_completata: false,
        stato_account:   "attivo",
        data_iscrizione: new Date().toISOString(),
      });
      if (error) { setErrore(error.message); return; }
      // Aggiorna candidatura
      await supabase.from("candidature").update({ stato: "approvata", note_admin: nota }).eq("id", c.id);
      router.refresh();
      onUpdate();
    });
  }

  async function rifiuta() {
    if (!nota.trim()) { setErrore("Inserisci un motivo per il rifiuto"); return; }
    setErrore("");
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("candidature").update({ stato: "rifiutata", note_admin: nota }).eq("id", c.id);
      router.refresh();
      onUpdate();
    });
  }

  const isInAttesa = c.stato === "in_attesa";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${isInAttesa ? "var(--color-gold)" : "var(--color-border)"}` }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:opacity-80 transition-opacity"
        style={{ backgroundColor: "var(--color-surface)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <span className="font-medium" style={{ color: "var(--color-pearl)" }}>
              {c.nome} {c.cognome}
            </span>
            <span className="ml-2 text-xs" style={{ color: "var(--color-muted)" }}>{c.email}</span>
          </div>
          {c.sponsor_referral_code && (
            <span className="text-xs px-1.5 py-0.5 rounded hidden sm:inline-block" style={{ backgroundColor: "var(--color-ash)", color: "var(--color-muted)" }}>
              via {c.sponsor_referral_code}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>{formatDate(c.created_at)}</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
            color: STATO_COLOR[c.stato] ?? "var(--color-muted)",
            backgroundColor: `${STATO_COLOR[c.stato]}22`,
          }}>
            {STATO_LABEL[c.stato] ?? c.stato}
          </span>
          <span style={{ color: "var(--color-muted)" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Dettaglio */}
      {expanded && (
        <div className="px-4 py-4 space-y-4" style={{ backgroundColor: "var(--color-smoke)", borderTop: "1px solid var(--color-border)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              ["Telefono", c.telefono || "—"],
              ["Referral sponsor", c.sponsor_referral_code || "Nessuno"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>{label}</p>
                <p style={{ color: "var(--color-pearl)" }}>{value}</p>
              </div>
            ))}
          </div>
          {c.motivazione && (
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>Motivazione</p>
              <p className="text-sm italic" style={{ color: "var(--color-pearl)" }}>"{c.motivazione}"</p>
            </div>
          )}

          {isInAttesa && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>
                  Note (opzionale per approvazione, obbligatorio per rifiuto)
                </label>
                <textarea
                  rows={2} value={nota} onChange={(e) => setNota(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                  style={{ backgroundColor: "var(--color-ash)", color: "var(--color-pearl)", border: "1px solid var(--color-border)" }}
                />
              </div>
              {errore && <p className="text-xs" style={{ color: "#ef4444" }}>{errore}</p>}
              <div className="flex gap-3">
                <button
                  onClick={rifiuta}
                  disabled={isPending}
                  className="flex-1 rounded-lg py-2 text-sm font-medium"
                  style={{ border: "1px solid #ef4444", color: "#ef4444", cursor: isPending ? "not-allowed" : "pointer" }}
                >
                  Rifiuta
                </button>
                <button
                  onClick={approva}
                  disabled={isPending}
                  className="flex-1 rounded-lg py-2 text-sm font-semibold"
                  style={{ backgroundColor: isPending ? "var(--color-ash)" : "#22c55e", color: "var(--color-ink)", cursor: isPending ? "not-allowed" : "pointer" }}
                >
                  {isPending ? "..." : "Approva → crea incaricato"}
                </button>
              </div>
            </div>
          )}

          {!isInAttesa && c.note_admin && (
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>Note admin</p>
              <p className="text-sm" style={{ color: "var(--color-pearl)" }}>{c.note_admin}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CandidatureClient({ candidature }: { candidature: Candidatura[] }) {
  const [filtro, setFiltro] = useState<"tutti" | "in_attesa" | "approvata" | "rifiutata">("in_attesa");
  const [lista, setLista]   = useState(candidature);

  const filtrate = filtro === "tutti" ? lista : lista.filter((c) => c.stato === filtro);

  return (
    <div className="space-y-4">
      {/* Filtri */}
      <div className="flex gap-2 flex-wrap">
        {(["tutti", "in_attesa", "approvata", "rifiutata"] as const).map((f) => {
          const count = f === "tutti" ? lista.length : lista.filter((c) => c.stato === f).length;
          return (
            <button key={f} onClick={() => setFiltro(f)}
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: filtro === f ? "var(--color-gold)" : "var(--color-ash)",
                color: filtro === f ? "var(--color-ink)" : "var(--color-muted)",
              }}>
              {STATO_LABEL[f] ?? "Tutti"} ({count})
            </button>
          );
        })}
      </div>

      {filtrate.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>Nessuna candidatura.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrate.map((c) => (
            <CandidaturaCard key={c.id} c={c} onUpdate={() => setLista((prev) =>
              prev.map((x) => x.id === c.id ? { ...x, stato: x.stato } : x)
            )} />
          ))}
        </div>
      )}
    </div>
  );
}
