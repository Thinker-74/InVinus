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

function Row({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex justify-between text-xs" style={{ color: gold ? "var(--color-gold)" : "var(--color-muted)" }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

type DashboardData = {
  nome: string; cognome: string; status: string; status_max: string;
  pv_min: number; gv_min: number; gv_prossimo: number;
  pv_mese: number; gv_mese: number;
  gv_l1: number; gv_l2: number; gv_l3: number; gv_l4: number;
  gv_l5: number; gv_l6: number; gv_l7: number; gv_l8: number;
  fatturato_mese: number; provvigione_pers: number;
  guadagno_personale: number; reddito_residuale: number; guadagno_totale: number;
};

export default async function DashboardPage() {
  const now  = new Date();
  const anno = now.getFullYear();
  const mese = now.getMonth() + 1;

  const supabase = await createClient();

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
        Errore: {error?.message ?? "nessun dato"}
      </div>
    );
  }

  const d = data as DashboardData;

  const pvMese      = Number(d.pv_mese);
  const gvMese      = Number(d.gv_mese);
  const pvMin       = Number(d.pv_min);
  const gvProssimo  = Number(d.gv_prossimo);
  const attivo      = pvMese >= pvMin;
  const percProv    = Math.round(Number(d.provvigione_pers) * 100);

  // Livelli residuale con GV > 0 (per mostrare solo righe significative)
  const livelliAttivi = [1,2,3,4,5,6,7,8].filter(
    (l) => Number(d[`gv_l${l}` as keyof DashboardData]) > 0
  );

  return (
    <div>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* Card 1 — PV mese */}
        <Card>
          <CardLabel>PV mese</CardLabel>
          <CardValue>{pvMese}</CardValue>
          <ProgressBar value={pvMese} max={pvMin} />
          <div className="mt-2 flex justify-between text-xs" style={{ color: "var(--color-muted)" }}>
            <span>Min attività: {pvMin}</span>
            <span>{pvMin > 0 ? Math.round((pvMese / pvMin) * 100) : 0}%</span>
          </div>
        </Card>

        {/* Card 2 — GV mese */}
        <Card>
          <CardLabel>GV mese (team)</CardLabel>
          <CardValue>{gvMese}</CardValue>
          <ProgressBar value={gvMese} max={gvProssimo} />
          <div className="mt-2 flex justify-between text-xs" style={{ color: "var(--color-muted)" }}>
            <span>Obiettivo: {gvProssimo.toLocaleString("it-IT")}</span>
            <span>{gvProssimo > 0 ? Math.round((gvMese / gvProssimo) * 100) : 0}%</span>
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
            <p>GV minimo: {Number(d.gv_min).toLocaleString("it-IT")}</p>
            <p style={{ color: attivo ? "#22c55e" : "#ef4444" }}>
              {attivo ? "● Attivo questo mese" : "● Inattivo — PV insufficienti"}
            </p>
          </div>
        </Card>

        {/* Card 4 — Guadagni */}
        <Card>
          <CardLabel>Guadagni stimati</CardLabel>
          <CardValue>€ {Number(d.guadagno_totale).toFixed(2)}</CardValue>
          <div className="mt-3 space-y-1.5 text-xs">
            <Row
              label={`Provvigione pers. (${percProv}% × ${pvMese} PV)`}
              value={`€ ${Number(d.guadagno_personale).toFixed(2)}`}
            />
            {livelliAttivi.length > 0 && (
              <>
                {livelliAttivi.map((l) => (
                  <Row
                    key={l}
                    label={`Residuale L${l} (${Number(d[`gv_l${l}` as keyof DashboardData])} GV)`}
                    value={`€ ${(Number(d[`gv_l${l}` as keyof DashboardData]) * Number(d.provvigione_pers)).toFixed(2)}`}
                  />
                ))}
              </>
            )}
            <div
              className="flex justify-between pt-1.5 text-xs font-semibold"
              style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-gold)" }}
            >
              <span>Totale</span>
              <span>€ {Number(d.guadagno_totale).toFixed(2)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
