"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aggiungiCliente } from "./actions";

type Cliente = {
  id: number;
  nome: string;
  cognome: string;
  email: string | null;
  telefono: string | null;
  segmento: string | null;
  data_primo_acquisto: string | null;
  ultimo_ordine: string | null;
  n_ordini: number;
  totale_speso: number;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function giorniDa(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// ── Form nuovo cliente ────────────────────────────────────────────────────────

function NuovoClienteForm({ onSuccess }: { onSuccess: () => void }) {
  const [aperto, setAperto]     = useState(false);
  const [nome, setNome]         = useState("");
  const [cognome, setCognome]   = useState("");
  const [email, setEmail]       = useState("");
  const [telefono, setTelefono] = useState("");
  const [errore, setErrore]     = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!nome.trim() || !cognome.trim()) { setErrore("Nome e cognome obbligatori"); return; }
    setErrore("");
    startTransition(async () => {
      const res = await aggiungiCliente(nome.trim(), cognome.trim(), email.trim(), telefono.trim());
      if (!res.success) { setErrore(res.error); return; }
      setNome(""); setCognome(""); setEmail(""); setTelefono("");
      setAperto(false);
      onSuccess();
    });
  }

  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        className="rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
        style={{ backgroundColor: "var(--color-gold)", color: "var(--color-ink)" }}
      >
        + Nuovo cliente
      </button>
    );
  }

  const inputStyle = {
    backgroundColor: "var(--color-ash)",
    color: "var(--color-pearl)",
    border: "1px solid var(--color-border)",
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-pearl)" }}>Nuovo cliente</h3>
        <button onClick={() => setAperto(false)} className="text-xs" style={{ color: "var(--color-muted)" }}>Annulla</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {([
          ["Nome *",    nome,     setNome,     "text"],
          ["Cognome *", cognome,  setCognome,  "text"],
          ["Email",     email,    setEmail,    "email"],
          ["Telefono",  telefono, setTelefono, "tel"],
        ] as const).map(([label, value, setter, type]) => (
          <div key={label}>
            <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>{label}</label>
            <input
              type={type}
              value={value}
              onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      {errore && <p className="mt-3 text-xs" style={{ color: "#ef4444" }}>{errore}</p>}

      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="mt-4 w-full rounded-lg py-2.5 text-sm font-medium transition-opacity"
        style={{
          backgroundColor: isPending ? "var(--color-ash)" : "var(--color-gold)",
          color: isPending ? "var(--color-muted)" : "var(--color-ink)",
          cursor: isPending ? "not-allowed" : "pointer",
        }}
      >
        {isPending ? "Salvataggio..." : "Aggiungi cliente"}
      </button>
    </div>
  );
}

// ── Tabella clienti ───────────────────────────────────────────────────────────

function ClientiTable({ clienti }: { clienti: Cliente[] }) {
  const router = useRouter();

  if (clienti.length === 0) {
    return (
      <div
        className="rounded-xl p-10 text-center"
        style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>Nessun cliente ancora. Aggiungine uno.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
      {/* Header */}
      <div
        className="hidden sm:grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-4 py-2 text-xs font-medium"
        style={{ backgroundColor: "var(--color-ash)", color: "var(--color-muted)" }}
      >
        <span>Cliente</span>
        <span>Contatti</span>
        <span>Ultimo ordine</span>
        <span className="text-right">Totale speso</span>
      </div>

      {/* Righe */}
      {clienti.map((c, i) => {
        const giorni = giorniDa(c.ultimo_ordine);
        const alertColor =
          giorni === null ? "var(--color-muted)" :
          giorni > 60     ? "#ef4444" :
          giorni > 30     ? "var(--color-gold)" :
          "#22c55e";

        return (
          <div
            key={c.id}
            onClick={() => router.push(`/clienti/${c.id}`)}
            className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 sm:gap-4 px-4 py-3 text-sm cursor-pointer transition-colors hover:opacity-80"
            style={{
              backgroundColor: i % 2 === 0 ? "var(--color-surface)" : "var(--color-smoke)",
              borderTop: i > 0 ? "1px solid var(--color-border)" : undefined,
            }}
          >
            {/* Nome */}
            <div>
              <span style={{ color: "var(--color-pearl)", fontWeight: 500 }}>
                {c.nome} {c.cognome}
              </span>
              {c.segmento && (
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--color-ash)", color: "var(--color-muted)" }}>
                  {c.segmento}
                </span>
              )}
            </div>

            {/* Contatti */}
            <div className="text-xs" style={{ color: "var(--color-muted)" }}>
              <div>{c.email || "—"}</div>
              <div>{c.telefono || "—"}</div>
            </div>

            {/* Ultimo ordine */}
            <div className="text-xs">
              <span style={{ color: alertColor }}>
                {c.ultimo_ordine ? formatDate(c.ultimo_ordine) : "Mai"}
              </span>
              {giorni !== null && (
                <span className="ml-1" style={{ color: "var(--color-muted)" }}>
                  ({giorni}gg fa)
                </span>
              )}
              <div style={{ color: "var(--color-muted)" }}>
                {c.n_ordini} {c.n_ordini === 1 ? "ordine" : "ordini"}
              </div>
            </div>

            {/* Totale */}
            <div className="text-right font-medium" style={{ color: "var(--color-gold)" }}>
              € {Number(c.totale_speso).toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function ClientiClient({ clienti }: { clienti: Cliente[] }) {
  void clienti; // ref per evitare warning — i dati vengono da server revalidation
  return (
    <div className="space-y-6">
      <NuovoClienteForm onSuccess={() => {}} />
      <ClientiTable clienti={clienti} />
    </div>
  );
}
