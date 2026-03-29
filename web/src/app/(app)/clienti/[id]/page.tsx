import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

const STATO_LABEL: Record<string, string> = {
  nuovo: "Nuovo", pagato: "Pagato", in_preparazione: "In prep.",
  spedito: "Spedito", consegnato: "Consegnato", annullato: "Annullato", reso: "Reso",
};
const STATO_COLOR: Record<string, string> = {
  pagato: "#22c55e", consegnato: "#22c55e", spedito: "var(--color-gold)",
  nuovo: "var(--color-pearl)", in_preparazione: "var(--color-gold)",
  annullato: "#ef4444", reso: "#ef4444",
};

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clienteId = parseInt(id);
  if (isNaN(clienteId)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: consulente } = await supabase
    .from("consulenti")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!consulente) redirect("/login");

  // Verifica che il cliente appartenga al consulente loggato
  const { data: cliente } = await supabase
    .from("clienti")
    .select("id, nome, cognome, email, telefono, segmento, note, data_primo_acquisto, gdpr_consenso")
    .eq("id", clienteId)
    .eq("consulente_id", consulente.id)
    .single();
  if (!cliente) notFound();

  const { data: ordini } = await supabase
    .from("ordini")
    .select("id, data, stato, tipo, totale, pv_generati")
    .eq("cliente_id", clienteId)
    .order("data", { ascending: false });

  const totaleSpeso   = (ordini ?? []).filter(o => o.stato !== "annullato").reduce((s, o) => s + Number(o.totale), 0);
  const pvTotali      = (ordini ?? []).filter(o => o.stato !== "annullato").reduce((s, o) => s + Number(o.pv_generati), 0);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Back */}
      <Link
        href="/clienti"
        className="text-xs flex items-center gap-1 w-fit hover:opacity-70 transition-opacity"
        style={{ color: "var(--color-muted)" }}
      >
        ← Clienti
      </Link>

      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}
        >
          {cliente.nome} {cliente.cognome}
        </h1>
        {cliente.segmento && (
          <span className="mt-1 inline-block text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "var(--color-ash)", color: "var(--color-muted)" }}>
            {cliente.segmento}
          </span>
        )}
      </div>

      {/* Info cliente */}
      <div
        className="rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm"
        style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        {[
          ["Email",               cliente.email || "—"],
          ["Telefono",            cliente.telefono || "—"],
          ["Primo acquisto",      cliente.data_primo_acquisto ? formatDate(cliente.data_primo_acquisto) : "—"],
          ["Segmento",            cliente.segmento || "—"],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs mb-0.5" style={{ color: "var(--color-muted)" }}>{label}</p>
            <p style={{ color: "var(--color-pearl)" }}>{value}</p>
          </div>
        ))}
        {cliente.note && (
          <div className="sm:col-span-2">
            <p className="text-xs mb-0.5" style={{ color: "var(--color-muted)" }}>Note</p>
            <p style={{ color: "var(--color-pearl)" }}>{cliente.note}</p>
          </div>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Ordini",       String((ordini ?? []).length)],
          ["Totale speso", `€ ${totaleSpeso.toFixed(2)}`],
          ["PV generati",  String(Math.round(pvTotali))],
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

      {/* Storico ordini */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-pearl)" }}>
          Storico ordini
        </h2>
        {(ordini ?? []).length === 0 ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>Nessun ordine ancora.</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
            {(ordini ?? []).map((o, i) => (
              <div
                key={o.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                style={{
                  backgroundColor: i % 2 === 0 ? "var(--color-surface)" : "var(--color-smoke)",
                  borderTop: i > 0 ? "1px solid var(--color-border)" : undefined,
                }}
              >
                <div>
                  <span style={{ color: "var(--color-pearl)" }}>{formatDate(o.data)}</span>
                  <span className="ml-2 text-xs capitalize" style={{ color: "var(--color-muted)" }}>{o.tipo}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span style={{ color: "var(--color-gold)" }}>€ {Number(o.totale).toFixed(2)}</span>
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>{Number(o.pv_generati)} PV</span>
                  <span
                    className="text-xs font-medium rounded px-1.5 py-0.5 min-w-[4rem] text-center"
                    style={{ color: STATO_COLOR[o.stato] ?? "var(--color-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}
                  >
                    {STATO_LABEL[o.stato] ?? o.stato}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
