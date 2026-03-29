"use client";

import { useState, useTransition } from "react";
import { creaOrdine, RigaOrdine } from "./actions";

type Ordine = {
  id: number;
  data: string;
  stato: string;
  tipo: string;
  totale: number;
  pv_generati: number;
  clienti: { nome: string; cognome: string } | null;
};

type Cliente = { id: number; nome: string; cognome: string };

type Prodotto = {
  id: number;
  nome: string;
  prezzo_pubblico: number;
  pv_valore: number;
};

const STATO_LABEL: Record<string, string> = {
  nuovo:          "Nuovo",
  pagato:         "Pagato",
  in_preparazione:"In prep.",
  spedito:        "Spedito",
  consegnato:     "Consegnato",
  annullato:      "Annullato",
  reso:           "Reso",
};

const STATO_COLOR: Record<string, string> = {
  pagato:    "#22c55e",
  consegnato:"#22c55e",
  spedito:   "var(--color-gold)",
  nuovo:     "var(--color-pearl)",
  in_preparazione: "var(--color-gold)",
  annullato: "#ef4444",
  reso:      "#ef4444",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Lista ordini ──────────────────────────────────────────────────────────────

function OrdiniList({ ordini }: { ordini: Ordine[] }) {
  if (ordini.length === 0) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>Nessun ordine ancora.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--color-border)" }}
    >
      {ordini.map((o, i) => (
        <div
          key={o.id}
          className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
          style={{
            backgroundColor: i % 2 === 0 ? "var(--color-surface)" : "var(--color-smoke)",
            borderBottom: i < ordini.length - 1 ? "1px solid var(--color-border)" : undefined,
          }}
        >
          <div className="min-w-0 flex-1">
            <span style={{ color: "var(--color-pearl)" }}>
              {o.clienti ? `${o.clienti.nome} ${o.clienti.cognome}` : "—"}
            </span>
            <span className="ml-2 text-xs" style={{ color: "var(--color-muted)" }}>
              {formatDate(o.data)}
            </span>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            <span style={{ color: "var(--color-gold)", fontVariantNumeric: "tabular-nums" }}>
              € {Number(o.totale).toFixed(2)}
            </span>
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              {Number(o.pv_generati)} PV
            </span>
            <span
              className="text-xs font-medium rounded px-1.5 py-0.5 min-w-[4rem] text-center"
              style={{
                color: STATO_COLOR[o.stato] ?? "var(--color-muted)",
                backgroundColor: "rgba(255,255,255,0.05)",
              }}
            >
              {STATO_LABEL[o.stato] ?? o.stato}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Form nuovo ordine ─────────────────────────────────────────────────────────

type RigaForm = { prodotto_id: number; quantita: number };

function NuovoOrdineForm({
  clienti,
  prodotti,
  onSuccess,
}: {
  clienti: Cliente[];
  prodotti: Prodotto[];
  onSuccess: () => void;
}) {
  const [aperto, setAperto] = useState(false);
  const [clienteId, setClienteId] = useState<number>(0);
  const [tipo, setTipo] = useState("vendita");
  const [righe, setRighe] = useState<RigaForm[]>([{ prodotto_id: 0, quantita: 1 }]);
  const [errore, setErrore] = useState("");
  const [isPending, startTransition] = useTransition();

  const prodottiMap = Object.fromEntries(prodotti.map((p) => [p.id, p]));

  function addRiga() {
    setRighe((r) => [...r, { prodotto_id: 0, quantita: 1 }]);
  }

  function removeRiga(i: number) {
    setRighe((r) => r.filter((_, idx) => idx !== i));
  }

  function updateRiga(i: number, field: keyof RigaForm, value: number) {
    setRighe((r) => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }

  const righeValide = righe.filter((r) => r.prodotto_id > 0 && r.quantita > 0);

  const totale = righeValide.reduce((sum, r) => {
    const p = prodottiMap[r.prodotto_id];
    return sum + (p ? p.prezzo_pubblico * r.quantita : 0);
  }, 0);

  const pvTotali = righeValide.reduce((sum, r) => {
    const p = prodottiMap[r.prodotto_id];
    return sum + (p ? p.pv_valore * r.quantita : 0);
  }, 0);

  function handleSubmit() {
    if (!clienteId) { setErrore("Seleziona un cliente"); return; }
    if (righeValide.length === 0) { setErrore("Aggiungi almeno un prodotto"); return; }
    setErrore("");

    const payload: RigaOrdine[] = righeValide.map((r) => ({
      prodotto_id: r.prodotto_id,
      quantita:    r.quantita,
    }));

    startTransition(async () => {
      const res = await creaOrdine(clienteId, tipo, payload);
      if (!res.success) {
        setErrore(res.error);
        return;
      }
      // Reset form
      setClienteId(0);
      setTipo("vendita");
      setRighe([{ prodotto_id: 0, quantita: 1 }]);
      setAperto(false);
      onSuccess();
    });
  }

  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        className="rounded-xl px-4 py-3 text-sm font-medium transition-opacity hover:opacity-80"
        style={{
          backgroundColor: "var(--color-gold)",
          color: "var(--color-ink)",
          border: "none",
        }}
      >
        + Nuovo ordine
      </button>
    );
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-pearl)" }}>
          Nuovo ordine
        </h3>
        <button
          onClick={() => setAperto(false)}
          className="text-xs"
          style={{ color: "var(--color-muted)" }}
        >
          Annulla
        </button>
      </div>

      <div className="space-y-4">
        {/* Cliente + tipo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Cliente</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(Number(e.target.value))}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: "var(--color-ash)",
                color: "var(--color-pearl)",
                border: "1px solid var(--color-border)",
              }}
            >
              <option value={0}>— Seleziona —</option>
              {clienti.map((c) => (
                <option key={c.id} value={c.id}>{c.nome} {c.cognome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: "var(--color-ash)",
                color: "var(--color-pearl)",
                border: "1px solid var(--color-border)",
              }}
            >
              <option value="vendita">Vendita</option>
              <option value="autoconsumo">Autoconsumo</option>
            </select>
          </div>
        </div>

        {/* Righe prodotto */}
        <div>
          <label className="block text-xs mb-2" style={{ color: "var(--color-muted)" }}>Prodotti</label>
          <div className="space-y-2">
            {righe.map((r, i) => {
              const prod = r.prodotto_id ? prodottiMap[r.prodotto_id] : null;
              const subtotale = prod ? prod.prezzo_pubblico * r.quantita : 0;
              const pvRiga = prod ? prod.pv_valore * r.quantita : 0;

              return (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={r.prodotto_id}
                    onChange={(e) => updateRiga(i, "prodotto_id", Number(e.target.value))}
                    className="flex-1 min-w-0 rounded-lg px-2 py-2 text-xs"
                    style={{
                      backgroundColor: "var(--color-ash)",
                      color: "var(--color-pearl)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <option value={0}>— Prodotto —</option>
                    {prodotti.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} — €{p.prezzo_pubblico.toFixed(2)} / {p.pv_valore} PV
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={r.quantita}
                    onChange={(e) => updateRiga(i, "quantita", Math.max(1, Number(e.target.value)))}
                    className="w-14 rounded-lg px-2 py-2 text-xs text-center"
                    style={{
                      backgroundColor: "var(--color-ash)",
                      color: "var(--color-pearl)",
                      border: "1px solid var(--color-border)",
                    }}
                  />

                  <span className="text-xs w-24 text-right flex-shrink-0" style={{ color: prod ? "var(--color-gold)" : "var(--color-muted)" }}>
                    {prod ? `€${subtotale.toFixed(2)} · ${pvRiga}PV` : "—"}
                  </span>

                  {righe.length > 1 && (
                    <button
                      onClick={() => removeRiga(i)}
                      className="text-xs flex-shrink-0"
                      style={{ color: "#ef4444" }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={addRiga}
            className="mt-2 text-xs"
            style={{ color: "var(--color-muted)" }}
          >
            + Aggiungi prodotto
          </button>
        </div>

        {/* Totali */}
        {righeValide.length > 0 && (
          <div
            className="flex justify-between items-center rounded-lg px-3 py-2 text-sm font-semibold"
            style={{ backgroundColor: "var(--color-ash)", color: "var(--color-gold)" }}
          >
            <span>Totale</span>
            <span>€ {totale.toFixed(2)} · {Math.round(pvTotali)} PV</span>
          </div>
        )}

        {errore && (
          <p className="text-xs" style={{ color: "#ef4444" }}>{errore}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full rounded-lg py-2.5 text-sm font-medium transition-opacity"
          style={{
            backgroundColor: isPending ? "var(--color-ash)" : "var(--color-gold)",
            color: isPending ? "var(--color-muted)" : "var(--color-ink)",
            cursor: isPending ? "not-allowed" : "pointer",
          }}
        >
          {isPending ? "Salvataggio..." : "Conferma ordine"}
        </button>
      </div>
    </div>
  );
}

// ── Export principale ─────────────────────────────────────────────────────────

export default function OrdiniClient({
  ordini: initialOrdini,
  clienti,
  prodotti,
}: {
  ordini: Ordine[];
  clienti: Cliente[];
  prodotti: Prodotto[];
}) {
  const [refresh, setRefresh] = useState(0);
  void refresh; // il revalidatePath gestisce il refresh lato server

  return (
    <div className="space-y-6">
      <NuovoOrdineForm
        clienti={clienti}
        prodotti={prodotti}
        onSuccess={() => setRefresh((n) => n + 1)}
      />
      <OrdiniList ordini={initialOrdini} />
    </div>
  );
}
