import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const MESI = ["", "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const STATO_LABEL: Record<string, string> = {
  calcolato: "Calcolato",
  approvato:  "Approvato",
  pagato:     "Pagato",
  sospeso:    "Sospeso",
};
const STATO_COLOR: Record<string, string> = {
  pagato:    "#22c55e",
  approvato: "var(--color-gold)",
  calcolato: "var(--color-muted)",
  sospeso:   "#ef4444",
};

function euro(n: number | null) {
  return `€ ${(n ?? 0).toFixed(2)}`;
}

export default async function ProvvigioniPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: consulente } = await supabase
    .from("incaricati")
    .select("id, nome, cognome")
    .eq("auth_user_id", user.id)
    .single();
  if (!consulente) redirect("/login");

  const { data: righe } = await supabase
    .from("provvigioni_mensili")
    .select("anno, mese, pv_mese, gv_mese, provvigione_personale, reddito_residuale, cab_bonus, bonus_car, global_pool, totale, stato, data_pagamento, era_attivo")
    .eq("incaricato_id", consulente.id)
    .order("anno", { ascending: false })
    .order("mese", { ascending: false });

  const dati = righe ?? [];

  const totaleLifetime = dati.reduce((s, r) => s + Number(r.totale ?? 0), 0);
  const mediaM         = dati.length > 0 ? totaleLifetime / dati.length : 0;
  const totalePagato   = dati.filter(r => r.stato === "pagato").reduce((s, r) => s + Number(r.totale ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}
        >
          Provvigioni
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          {consulente.nome} {consulente.cognome}
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Totale lifetime",  euro(totaleLifetime)],
          ["Media mensile",    euro(mediaM)],
          ["Già pagato",       euro(totalePagato)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl p-4 text-center"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-xl font-bold" style={{ color: "var(--color-gold)" }}>{value}</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Tabella */}
      {dati.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Nessuna provvigione calcolata ancora.
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            Il calcolo viene eseguito a fine mese dall&apos;amministratore.
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
          {/* Header colonne */}
          <div
            className="hidden lg:grid gap-3 px-4 py-2 text-xs font-medium"
            style={{
              gridTemplateColumns: "5rem 4rem 4rem 1fr 1fr 1fr 1fr 5rem",
              backgroundColor: "var(--color-ash)",
              color: "var(--color-muted)",
            }}
          >
            <span>Periodo</span>
            <span className="text-right">PV</span>
            <span className="text-right">GV</span>
            <span className="text-right">Pers.</span>
            <span className="text-right">Residuale</span>
            <span className="text-right">Bonus</span>
            <span className="text-right font-semibold">Totale</span>
            <span className="text-right">Stato</span>
          </div>

          {dati.map((r, i) => {
            const bonusTot = Number(r.cab_bonus ?? 0) + Number(r.bonus_car ?? 0) + Number(r.global_pool ?? 0);
            return (
              <div
                key={`${r.anno}-${r.mese}`}
                className="grid grid-cols-2 lg:grid gap-2 lg:gap-3 px-4 py-3 text-sm"
                style={{
                  gridTemplateColumns: "1fr 1fr",
                  ["--lg-cols" as string]: "5rem 4rem 4rem 1fr 1fr 1fr 1fr 5rem",
                  backgroundColor: i % 2 === 0 ? "var(--color-surface)" : "var(--color-smoke)",
                  borderTop: i > 0 ? "1px solid var(--color-border)" : undefined,
                }}
              >
                {/* Mobile: layout a 2 colonne semplificato */}
                <div className="lg:hidden col-span-2 flex justify-between items-start">
                  <div>
                    <span style={{ color: "var(--color-pearl)", fontWeight: 500 }}>
                      {MESI[r.mese]} {r.anno}
                    </span>
                    {!r.era_attivo && (
                      <span className="ml-2 text-xs" style={{ color: "#ef4444" }}>inattivo</span>
                    )}
                  </div>
                  <span
                    className="text-xs font-medium rounded px-1.5 py-0.5"
                    style={{ color: STATO_COLOR[r.stato] ?? "var(--color-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}
                  >
                    {STATO_LABEL[r.stato] ?? r.stato}
                  </span>
                </div>
                <div className="lg:hidden text-xs space-y-0.5" style={{ color: "var(--color-muted)" }}>
                  <div>PV {Number(r.pv_mese).toFixed(0)} · GV {Number(r.gv_mese).toFixed(0)}</div>
                  <div>Pers. {euro(Number(r.provvigione_personale))}</div>
                  <div>Resid. {euro(Number(r.reddito_residuale))}</div>
                  {bonusTot > 0 && <div>Bonus {euro(bonusTot)}</div>}
                </div>
                <div className="lg:hidden text-right">
                  <span className="font-semibold" style={{ color: "var(--color-gold)" }}>
                    {euro(Number(r.totale))}
                  </span>
                </div>

                {/* Desktop: una colonna per campo */}
                <div className="hidden lg:block">
                  <span style={{ color: "var(--color-pearl)", fontWeight: 500 }}>
                    {MESI[r.mese]} {r.anno}
                  </span>
                  {!r.era_attivo && (
                    <span className="ml-1 text-xs" style={{ color: "#ef4444" }}>inattivo</span>
                  )}
                </div>
                <div className="hidden lg:block text-right" style={{ color: "var(--color-muted)" }}>
                  {Number(r.pv_mese).toFixed(0)}
                </div>
                <div className="hidden lg:block text-right" style={{ color: "var(--color-muted)" }}>
                  {Number(r.gv_mese).toFixed(0)}
                </div>
                <div className="hidden lg:block text-right" style={{ color: "var(--color-pearl)" }}>
                  {euro(Number(r.provvigione_personale))}
                </div>
                <div className="hidden lg:block text-right" style={{ color: "var(--color-pearl)" }}>
                  {euro(Number(r.reddito_residuale))}
                </div>
                <div className="hidden lg:block text-right" style={{ color: bonusTot > 0 ? "var(--color-pearl)" : "var(--color-muted)" }}>
                  {bonusTot > 0 ? euro(bonusTot) : "—"}
                </div>
                <div className="hidden lg:block text-right font-semibold" style={{ color: "var(--color-gold)" }}>
                  {euro(Number(r.totale))}
                </div>
                <div className="hidden lg:block text-right">
                  <span
                    className="text-xs font-medium rounded px-1.5 py-0.5"
                    style={{ color: STATO_COLOR[r.stato] ?? "var(--color-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}
                  >
                    {STATO_LABEL[r.stato] ?? r.stato}
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
