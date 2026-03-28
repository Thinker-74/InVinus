import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const MESI_IT = [
  "", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="mt-3 h-1.5 w-full rounded-full" style={{ backgroundColor: "var(--color-ash)" }}>
      <div
        className="h-1.5 rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: "var(--color-gold)" }}
      />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
      {children}
    </p>
  );
}

function CardValue({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-3xl font-bold" style={{ color: "var(--color-pearl)" }}>
      {children}
    </p>
  );
}

export default async function DashboardPage() {
  const now   = new Date();
  const anno  = now.getFullYear();
  const mese  = now.getMonth() + 1;

  const supabase = await createClient();

  // Recupera l'utente autenticato e il consulente collegato
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: consulente } = await supabase
    .from("consulenti")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!consulente) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-muted)" }}>
        Nessun consulente associato a questo account.
      </div>
    );
  }

  const { data, error } = await supabase
    .rpc("get_dashboard_consulente", {
      p_consulente_id: consulente.id,
      p_anno:          anno,
      p_mese:          mese,
    })
    .single();

  if (error || !data) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-muted)" }}>
        Errore nel caricamento dashboard: {error?.message ?? "nessun dato"}
      </div>
    );
  }

  const d = data as {
    nome: string; cognome: string; status: string; status_max: string;
    pv_min: number; gv_min: number; gv_prossimo: number;
    pv_mese: number; gv_mese: number;
    fatturato_mese: number; provvigione_pers: number;
  };

  const guadagniStimati = Number(d.fatturato_mese) * Number(d.provvigione_pers);
  const pvMese          = Number(d.pv_mese);
  const gvMese          = Number(d.gv_mese);
  const pvMin           = Number(d.pv_min);
  const gvProssimo      = Number(d.gv_prossimo);
  const attivo          = pvMese >= pvMin;

  return (
    <div>
      {/* Intestazione */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}
        >
          Ciao, {d.nome}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          {MESI_IT[mese]} {anno} ·{" "}
          <span style={{ color: "var(--color-gold)" }}>{d.status}</span>
        </p>
      </div>

      {/* 4 card KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* Card 1 — PV mese */}
        <Card>
          <CardLabel>PV mese</CardLabel>
          <CardValue>{pvMese}</CardValue>
          <ProgressBar value={pvMese} max={pvMin} />
          <div className="mt-2 flex justify-between text-xs" style={{ color: "var(--color-muted)" }}>
            <span>Min attività: {pvMin}</span>
            <span>
              {pvMin > 0 ? Math.round((pvMese / pvMin) * 100) : 0}%
            </span>
          </div>
        </Card>

        {/* Card 2 — GV mese */}
        <Card>
          <CardLabel>GV mese (team)</CardLabel>
          <CardValue>{gvMese}</CardValue>
          <ProgressBar value={gvMese} max={gvProssimo} />
          <div className="mt-2 flex justify-between text-xs" style={{ color: "var(--color-muted)" }}>
            <span>Obiettivo: {gvProssimo.toLocaleString("it-IT")}</span>
            <span>
              {gvProssimo > 0 ? Math.round((gvMese / gvProssimo) * 100) : 0}%
            </span>
          </div>
        </Card>

        {/* Card 3 — Status */}
        <Card>
          <CardLabel>Status attuale</CardLabel>
          <p
            className="mt-1 text-3xl font-bold"
            style={{ fontFamily: "var(--font-playfair)", color: "var(--color-gold)" }}
          >
            {d.status}
          </p>
          <div className="mt-3 space-y-1 text-xs" style={{ color: "var(--color-muted)" }}>
            <p>Status massimo: {d.status_max}</p>
            <p>Min GV corrente: {Number(d.gv_min).toLocaleString("it-IT")}</p>
            <p style={{ color: attivo ? "#22c55e" : "#ef4444" }}>
              {attivo ? "● Attivo questo mese" : "● Inattivo — PV insufficienti"}
            </p>
          </div>
        </Card>

        {/* Card 4 — Guadagni stimati */}
        <Card>
          <CardLabel>Guadagni stimati</CardLabel>
          <CardValue>€ {guadagniStimati.toFixed(2)}</CardValue>
          <div className="mt-3 space-y-1.5 text-xs" style={{ color: "var(--color-muted)" }}>
            <div className="flex justify-between">
              <span>Fatturato personale</span>
              <span>€ {Number(d.fatturato_mese).toFixed(2)}</span>
            </div>
            <div
              className="flex justify-between pt-1.5"
              style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-gold)" }}
            >
              <span>Provvigione ({Math.round(Number(d.provvigione_pers) * 100)}%)</span>
              <span>€ {guadagniStimati.toFixed(2)}</span>
            </div>
            <p className="text-xs pt-1" style={{ color: "var(--color-ash)", fontStyle: "italic" }}>
              Reddito residuale: disponibile in Fase 1
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
