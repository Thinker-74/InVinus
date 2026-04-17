import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function AdminIncaricatoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incaricatoId = parseInt(id);
  if (isNaN(incaricatoId)) notFound();

  const supabase = await createClient();
  const now = new Date();
  const anno = now.getFullYear();
  const mese = now.getMonth() + 1;

  const { data: incaricato } = await supabase
    .from("incaricati")
    .select("id, nome, cognome, status, status_max, email, telefono, data_iscrizione, ruolo, link_referral, attivo")
    .eq("id", incaricatoId)
    .single();
  if (!incaricato) notFound();

  const [{ data: team }, { data: ordini }] = await Promise.all([
    supabase.rpc("get_team_incaricato", { p_incaricato_id: incaricatoId, p_anno: anno, p_mese: mese }),
    supabase.from("ordini")
      .select("pv_generati, totale, data")
      .eq("incaricato_id", incaricatoId)
      .eq("stato", "pagato")
      .gte("data", `${anno}-${String(mese).padStart(2, "0")}-01`)
      .order("data", { ascending: false })
      .limit(10),
  ]);

  const pvMese = (ordini ?? []).reduce((s, o) => s + Number(o.pv_generati), 0);
  const fatturato = (ordini ?? []).reduce((s, o) => s + Number(o.totale), 0);
  const livelli = [...new Set((team ?? []).map((t) => t.livello))].sort();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/incaricati" className="text-xs flex items-center gap-1 w-fit hover:opacity-70"
        style={{ color: "var(--color-muted)" }}>
        ← Incaricati
      </Link>

      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}>
          {incaricato.nome} {incaricato.cognome}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-gold)" }}>{incaricato.status}</p>
      </div>

      {/* Info */}
      <div className="rounded-xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm"
        style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        {[
          ["Email", incaricato.email], ["Telefono", incaricato.telefono ?? "—"],
          ["Iscritto", formatDate(incaricato.data_iscrizione)],
          ["Status max", incaricato.status_max], ["Ruolo", incaricato.ruolo],
          ["Referral", incaricato.link_referral ?? "—"],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs mb-0.5" style={{ color: "var(--color-muted)" }}>{label}</p>
            <p style={{ color: "var(--color-pearl)" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* KPI mese */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ["PV mese", String(pvMese.toFixed(0))],
          ["Fatturato mese", `€ ${fatturato.toFixed(2)}`],
          ["Team size", String((team ?? []).length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl p-4 text-center"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--color-gold)" }}>{value}</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Downline */}
      {livelli.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-pearl)" }}>Downline</h2>
          {livelli.map((liv) => {
            const membri = (team ?? []).filter((t) => t.livello === liv);
            return (
              <div key={liv} className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-gold)" }}>
                  L{liv} — {membri.length} {membri.length === 1 ? "membro" : "membri"}
                </p>
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
                  {membri.map((m, i) => (
                    <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm"
                      style={{
                        backgroundColor: i % 2 === 0 ? "var(--color-surface)" : "var(--color-smoke)",
                        borderTop: i > 0 ? "1px solid var(--color-border)" : undefined,
                      }}>
                      <div>
                        <span style={{ color: "var(--color-pearl)" }}>{m.nome} {m.cognome}</span>
                        <span className="ml-2 text-xs" style={{ color: "var(--color-muted)" }}>{m.status}</span>
                      </div>
                      <span className="text-xs" style={{ color: m.pv_mese >= m.pv_min ? "#22c55e" : "#ef4444" }}>
                        {m.pv_mese}/{m.pv_min} PV
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
