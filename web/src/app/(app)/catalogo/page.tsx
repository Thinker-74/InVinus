import { createClient } from "@/lib/supabase/server";
import CatalogoClient from "./CatalogoClient";

export type ProdottoConJoin = {
  id: number;
  nome: string;
  alcol: number;
  annata: number | null;
  prezzo_pubblico: number;
  pv_valore: number;
  tipo: string;
  temp_servizio_min: number;
  temp_servizio_max: number;
  regione: string;
  cantina: string;
};

const TIPO_COLOR: Record<string, string> = {
  rosso:    "#dc2626",
  bianco:   "#ca8a04",
  rosato:   "#db2777",
  spumante: "#7c3aed",
};

export default async function CatalogoPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("prodotti")
    .select(`
      id,
      nome,
      alcol,
      annata,
      prezzo_pubblico,
      pv_valore,
      tipo,
      temp_servizio_min,
      temp_servizio_max,
      disponibile,
      regioni ( nome ),
      cantine_fornitrici ( nome )
    `)
    .eq("disponibile", true)
    .order("nome");

  if (error) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-muted)" }}>
        Errore nel caricamento del catalogo: {error.message}
      </div>
    );
  }

  const prodotti: ProdottoConJoin[] = (data ?? []).map((r) => ({
    id:               r.id,
    nome:             r.nome,
    alcol:            r.alcol,
    annata:           r.annata,
    prezzo_pubblico:  r.prezzo_pubblico,
    pv_valore:        r.pv_valore,
    tipo:             r.tipo,
    temp_servizio_min: r.temp_servizio_min,
    temp_servizio_max: r.temp_servizio_max,
    regione:          (r.regioni as { nome: string } | null)?.nome ?? "—",
    cantina:          (r.cantine_fornitrici as { nome: string } | null)?.nome ?? "—",
  }));

  const regioni = ["Tutte", ...Array.from(new Set(prodotti.map((p) => p.regione))).sort()];
  const tipi    = ["Tutti", ...Array.from(new Set(prodotti.map((p) => p.tipo))).sort()];

  return (
    <CatalogoClient
      prodotti={prodotti}
      tipoColor={TIPO_COLOR}
      regioni={regioni}
      tipi={tipi}
    />
  );
}
