"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

const MESI = ["", "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const STATO_COLOR: Record<string, string> = {
  calcolato: "var(--color-muted)",
  approvato: "var(--color-gold)",
  pagato:    "#22c55e",
  sospeso:   "#ef4444",
};

type Riga = {
  id: number;
  consulente_id: number;
  anno: number;
  mese: number;
  pv_mese: number;
  gv_mese: number;
  provvigione_personale: number;
  reddito_residuale: number;
  cab_bonus: number;
  bonus_car: number;
  global_pool: number;
  totale: number;
  stato: string;
  era_attivo: boolean;
  status_al_calcolo: string;
  nome?: string;
  cognome?: string;
};

function euro(n: number) { return `€ ${n.toFixed(2)}`; }

export default function AdminProvvigioniPage() {
  const now = new Date();
  const [anno, setAnno]       = useState(now.getFullYear());
  const [mese, setMese]       = useState(now.getMonth() + 1);
  const [righe, setRighe]     = useState<Riga[]>([]);
  const [loading, setLoading] = useState(true);
  const [calcolando, startCalcolo] = useTransition();
  const [approvando, startApprova] = useTransition();
  const [msg, setMsg]         = useState("");

  async function caricaDati(a: number, m: number) {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("provvigioni_mensili")
      .select(`id, consulente_id, anno, mese, pv_mese, gv_mese, provvigione_personale,
               reddito_residuale, cab_bonus, bonus_car, global_pool, totale, stato,
               era_attivo, status_al_calcolo,
               consulenti(nome, cognome)`)
      .eq("anno", a)
      .eq("mese", m)
      .order("totale", { ascending: false });
    const mapped = (data ?? []).map((r: Record<string, unknown>) => ({
      ...(r as Omit<Riga, "nome" | "cognome">),
      nome: (r.consulenti as { nome: string } | null)?.nome,
      cognome: (r.consulenti as { cognome: string } | null)?.cognome,
    }));
    setRighe(mapped as Riga[]);
    setLoading(false);
  }

  useEffect(() => { caricaDati(anno, mese); }, [anno, mese]);

  function calcola() {
    setMsg("");
    startCalcolo(async () => {
      const res = await fetch("/api/admin/calcola-provvigioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno, mese }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg(`Errore: ${json.error}`); return; }
      setMsg(`Calcolato: ${json.consulentiAttivi} attivi, ${json.consulentiInattivi} inattivi — totale ${euro(json.totaleLordo)}`);
      caricaDati(anno, mese);
    });
  }

  function approva() {
    setMsg("");
    startApprova(async () => {
      const supabase = createClient();
      const ids = righe.filter((r) => r.stato === "calcolato").map((r) => r.id);
      if (ids.length === 0) { setMsg("Nessuna riga 'calcolato' da approvare."); return; }
      const { error } = await supabase
        .from("provvigioni_mensili")
        .update({ stato: "approvato" })
        .in("id", ids);
      if (error) { setMsg(`Errore: ${error.message}`); return; }
      setMsg(`${ids.length} righe approvate.`);
      caricaDati(anno, mese);
    });
  }

  const totaleCalcolato = righe.reduce((s, r) => s + Number(r.totale), 0);
  const haCalcolato = righe.some((r) => r.stato === "calcolato");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}>
          Provvigioni Admin
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          Calcolo batch e approvazione mensile
        </p>
      </div>

      {/* Selettore periodo + azioni */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={mese}
          onChange={(e) => setMese(Number(e.target.value))}
          className="rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--color-ash)", color: "var(--color-pearl)", border: "1px solid var(--color-border)" }}
        >
          {MESI.slice(1).map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={anno}
          onChange={(e) => setAnno(Number(e.target.value))}
          className="rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--color-ash)", color: "var(--color-pearl)", border: "1px solid var(--color-border)" }}
        >
          {[now.getFullYear() - 1, now.getFullYear()].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <button
          onClick={calcola}
          disabled={calcolando}
          className="rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ backgroundColor: calcolando ? "var(--color-ash)" : "var(--color-gold)", color: "var(--color-ink)", cursor: calcolando ? "not-allowed" : "pointer" }}
        >
          {calcolando ? "Calcolo in corso..." : "Calcola provvigioni mese"}
        </button>

        {haCalcolato && (
          <button
            onClick={approva}
            disabled={approvando}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ border: "1px solid var(--color-gold)", color: "var(--color-gold)", cursor: approvando ? "not-allowed" : "pointer" }}
          >
            {approvando ? "..." : "Approva e segna come pagabili"}
          </button>
        )}
      </div>

      {msg && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{
          backgroundColor: msg.startsWith("Errore") ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
          color: msg.startsWith("Errore") ? "#ef4444" : "#22c55e",
          border: `1px solid ${msg.startsWith("Errore") ? "#ef444433" : "#22c55e33"}`,
        }}>
          {msg}
        </p>
      )}

      {/* KPI summary */}
      {righe.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Consulenti",    String(righe.length)],
            ["Attivi",        String(righe.filter((r) => r.era_attivo).length)],
            ["Totale lordo",  euro(totaleCalcolato)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl p-4 text-center"
              style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <p className="text-xl font-bold" style={{ color: "var(--color-gold)" }}>{value}</p>
              <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabella */}
      {loading ? (
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>Caricamento...</p>
      ) : righe.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Nessun calcolo per {MESI[mese]} {anno}.
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            Premi "Calcola provvigioni mese" per avviare il batch.
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
          {/* Header */}
          <div className="hidden lg:grid gap-2 px-4 py-2 text-xs font-medium"
            style={{ gridTemplateColumns: "1fr 5rem 4rem 4rem 1fr 1fr 1fr 1fr 5rem", backgroundColor: "var(--color-ash)", color: "var(--color-muted)" }}>
            <span>Consulente</span>
            <span>Status</span>
            <span className="text-right">PV</span>
            <span className="text-right">GV</span>
            <span className="text-right">Personale</span>
            <span className="text-right">Residuale</span>
            <span className="text-right">Bonus</span>
            <span className="text-right font-semibold">Totale</span>
            <span className="text-right">Stato</span>
          </div>

          {righe.map((r, i) => {
            const bonusTot = Number(r.cab_bonus) + Number(r.bonus_car) + Number(r.global_pool);
            return (
              <div key={r.id}
                className="grid grid-cols-2 lg:grid gap-2 px-4 py-3 text-sm"
                style={{
                  gridTemplateColumns: "1fr 5rem 4rem 4rem 1fr 1fr 1fr 1fr 5rem",
                  backgroundColor: i % 2 === 0 ? "var(--color-surface)" : "var(--color-smoke)",
                  borderTop: i > 0 ? "1px solid var(--color-border)" : undefined,
                }}>
                {/* Mobile */}
                <div className="lg:hidden col-span-2 flex justify-between">
                  <div>
                    <span style={{ color: "var(--color-pearl)", fontWeight: 500 }}>{r.nome} {r.cognome}</span>
                    {!r.era_attivo && <span className="ml-2 text-xs" style={{ color: "#ef4444" }}>inattivo</span>}
                  </div>
                  <span className="text-xs" style={{ color: STATO_COLOR[r.stato] ?? "var(--color-muted)" }}>{r.stato}</span>
                </div>
                <div className="lg:hidden text-xs col-span-2" style={{ color: "var(--color-muted)" }}>
                  {r.status_al_calcolo} · PV {Number(r.pv_mese).toFixed(0)} · GV {Number(r.gv_mese).toFixed(0)} ·{" "}
                  <span style={{ color: "var(--color-gold)", fontWeight: 600 }}>{euro(Number(r.totale))}</span>
                </div>

                {/* Desktop */}
                <div className="hidden lg:block">
                  <span style={{ color: "var(--color-pearl)", fontWeight: 500 }}>{r.nome} {r.cognome}</span>
                  {!r.era_attivo && <span className="ml-2 text-xs" style={{ color: "#ef4444" }}>inattivo</span>}
                </div>
                <div className="hidden lg:block text-xs" style={{ color: "var(--color-muted)" }}>{r.status_al_calcolo}</div>
                <div className="hidden lg:block text-right" style={{ color: "var(--color-muted)" }}>{Number(r.pv_mese).toFixed(0)}</div>
                <div className="hidden lg:block text-right" style={{ color: "var(--color-muted)" }}>{Number(r.gv_mese).toFixed(0)}</div>
                <div className="hidden lg:block text-right" style={{ color: "var(--color-pearl)" }}>{euro(Number(r.provvigione_personale))}</div>
                <div className="hidden lg:block text-right" style={{ color: "var(--color-pearl)" }}>{euro(Number(r.reddito_residuale))}</div>
                <div className="hidden lg:block text-right" style={{ color: bonusTot > 0 ? "var(--color-pearl)" : "var(--color-muted)" }}>
                  {bonusTot > 0 ? euro(bonusTot) : "—"}
                </div>
                <div className="hidden lg:block text-right font-semibold" style={{ color: "var(--color-gold)" }}>
                  {euro(Number(r.totale))}
                </div>
                <div className="hidden lg:block text-right">
                  <span className="text-xs font-medium rounded px-1.5 py-0.5"
                    style={{ color: STATO_COLOR[r.stato] ?? "var(--color-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>
                    {r.stato}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
