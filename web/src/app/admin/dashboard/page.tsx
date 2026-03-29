import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const MESI_SHORT = ["", "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>{label}</p>
      <p className="mt-1 text-3xl font-bold" style={{ color: "var(--color-pearl)" }}>{value}</p>
      {sub && <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>{sub}</p>}
    </div>
  );
}

function BarChart({ data }: { data: { anno: number; mese: number; fatturato: number; n_ordini: number }[] }) {
  if (data.length === 0) return (
    <p className="text-sm text-center py-8" style={{ color: "var(--color-muted)" }}>Nessun dato disponibile</p>
  );
  const maxFat = Math.max(...data.map((d) => d.fatturato), 1);

  return (
    <div className="flex items-end gap-3 h-40 mt-4">
      {data.map((d) => {
        const pct = (d.fatturato / maxFat) * 100;
        return (
          <div key={`${d.anno}-${d.mese}`} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs" style={{ color: "var(--color-gold)" }}>
              €{d.fatturato > 999 ? `${(d.fatturato / 1000).toFixed(1)}k` : d.fatturato.toFixed(0)}
            </span>
            <div className="w-full rounded-t-sm" style={{ height: `${Math.max(pct, 4)}%`, backgroundColor: "var(--color-gold)", opacity: 0.8 }} />
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              {MESI_SHORT[d.mese]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  STARTER: "#6b7280", APPRENTICE: "#3b82f6", ADVISOR: "#8b5cf6",
  SUPERVISOR: "#f59e0b", TEAM_COORDINATOR: "#f97316",
  MANAGER: "#ef4444", DIRECTOR: "#22c55e", AMBASSADOR: "#ec4899", GOLDEN: "var(--color-gold)",
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now   = new Date();
  const anno  = now.getFullYear();
  const mese  = now.getMonth() + 1;

  const [kpiRes, trendRes, topRes] = await Promise.all([
    supabase.rpc("get_admin_kpi", { p_anno: anno, p_mese: mese }).single(),
    supabase.rpc("get_admin_trend", { p_mesi: 6 }),
    supabase.rpc("get_admin_top_consulenti", { p_anno: anno, p_mese: mese, p_limit: 5 }),
  ]);

  const kpi  = kpiRes.data;
  const trend = (trendRes.data ?? []) as { anno: number; mese: number; fatturato: number; n_ordini: number }[];
  const top   = topRes.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}>
          Dashboard Admin
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          {MESI_SHORT[mese]} {anno} · Vista globale rete
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Fatturato mese"     value={`€ ${Number(kpi?.fatturato_mese ?? 0).toFixed(2)}`} />
        <KpiCard label="Ordini mese"        value={String(kpi?.ordini_mese ?? 0)} />
        <KpiCard label="Consulenti attivi"  value={String(kpi?.consulenti_attivi ?? 0)} sub="PV ≥ minimo status" />
        <KpiCard label="Nuovi iscritti"     value={String(kpi?.nuovi_iscritti ?? 0)} sub="questo mese" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Trend 6 mesi */}
        <div className="rounded-xl p-5" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--color-pearl)" }}>Fatturato ultimi 6 mesi</p>
          <BarChart data={trend} />
        </div>

        {/* Top 5 consulenti */}
        <div className="rounded-xl p-5" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--color-pearl)" }}>Top 5 consulenti — PV mese</p>
          {top.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>Nessun dato</p>
          ) : (
            <div className="space-y-3">
              {(top as { id: number; nome: string; cognome: string; status: string; pv_mese: number }[]).map((c, i) => {
                const maxPv = Number((top as { pv_mese: number }[])[0]?.pv_mese ?? 1);
                const pct   = maxPv > 0 ? (Number(c.pv_mese) / maxPv) * 100 : 0;
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-xs w-4 text-right flex-shrink-0" style={{ color: "var(--color-muted)" }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm truncate" style={{ color: "var(--color-pearl)" }}>
                          {c.nome} {c.cognome}
                        </span>
                        <span className="text-xs ml-2 flex-shrink-0" style={{ color: "var(--color-gold)" }}>
                          {Number(c.pv_mese)} PV
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ backgroundColor: "var(--color-ash)" }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: STATUS_BADGE[c.status] ?? "var(--color-gold)" }} />
                      </div>
                    </div>
                    <span className="text-xs w-20 text-right flex-shrink-0 hidden sm:block" style={{ color: "var(--color-muted)" }}>
                      {c.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
