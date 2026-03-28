"use client";

import { useState } from "react";
import type { ProdottoConJoin } from "./page";

type Props = {
  prodotti: ProdottoConJoin[];
  tipoColor: Record<string, string>;
  regioni: string[];
  tipi: string[];
};

function ProductCard({ p, tipoColor }: { p: ProdottoConJoin; tipoColor: Record<string, string> }) {
  const dotColor = tipoColor[p.tipo] ?? "var(--color-muted)";
  const temp = `${p.temp_servizio_min}–${p.temp_servizio_max}°C`;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight line-clamp-2" style={{ color: "var(--color-pearl)" }}>
            {p.nome}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
            {p.cantina}{p.annata ? ` · ${p.annata}` : ""}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize"
          style={{ backgroundColor: dotColor + "22", color: dotColor }}
        >
          {p.tipo}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1 text-xs" style={{ color: "var(--color-muted)" }}>
        <span>🌡 {temp}</span>
        <span>🍷 {p.alcol}% vol</span>
        <span>📍 {p.regione}</span>
        <span style={{ color: "var(--color-gold)" }}>PV {p.pv_valore}</span>
      </div>

      <div
        className="flex items-center justify-between mt-auto pt-2"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <span className="text-lg font-bold" style={{ color: "var(--color-pearl)" }}>
          € {p.prezzo_pubblico.toFixed(2)}
        </span>
        <button
          className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: "var(--color-gold)", color: "var(--color-ink)" }}
        >
          Aggiungi
        </button>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap"
      style={{
        backgroundColor: active ? "var(--color-gold)" : "var(--color-surface)",
        color: active ? "var(--color-ink)" : "var(--color-muted)",
        border: "1px solid var(--color-border)",
      }}
    >
      {label}
    </button>
  );
}

export default function CatalogoClient({ prodotti, tipoColor, regioni, tipi }: Props) {
  const [regione, setRegione] = useState("Tutte");
  const [tipo, setTipo]       = useState("Tutti");
  const [search, setSearch]   = useState("");

  const filtered = prodotti.filter((p) => {
    if (regione !== "Tutte" && p.regione !== regione) return false;
    if (tipo    !== "Tutti" && p.tipo    !== tipo)    return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.nome.toLowerCase().includes(q) && !p.cantina.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}
        >
          Catalogo Vini 2026
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          {filtered.length} / {prodotti.length} prodotti
        </p>
      </div>

      {/* Ricerca */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Cerca vino o cantina…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-pearl)",
          }}
        />
      </div>

      {/* Filtro regione */}
      <div className="mb-3 flex gap-2 flex-wrap">
        {regioni.map((r) => (
          <FilterChip key={r} label={r} active={regione === r} onClick={() => setRegione(r)} />
        ))}
      </div>

      {/* Filtro tipo */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {tipi.map((t) => (
          <FilterChip key={t} label={t} active={tipo === t} onClick={() => setTipo(t)} />
        ))}
      </div>

      {/* Griglia */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm" style={{ color: "var(--color-muted)" }}>
          Nessun prodotto trovato.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} p={p} tipoColor={tipoColor} />
          ))}
        </div>
      )}
    </div>
  );
}
