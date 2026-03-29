"use client";

import { useState, useTransition, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://invinus.it";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

type Consulente = {
  id: number; nome: string; cognome: string; status: string;
  link_referral: string; foto_url: string | null;
  bio: string; messaggio_referral: string; specialita: string;
};
type Prodotto = { id: number; nome: string; tipo: string; denominazione: string; regioni: { nome: string } | null };

// ── Preview landing ───────────────────────────────────────────────────────────

function LandingPreview({
  consulente, bio, messaggio, specialita, fotoUrl, viniSelezionati, prodotti,
}: {
  consulente: Consulente; bio: string; messaggio: string; specialita: string;
  fotoUrl: string | null; viniSelezionati: number[]; prodotti: Prodotto[];
}) {
  const viniToShow = viniSelezionati.length > 0
    ? viniSelezionati.map((id) => prodotti.find((p) => p.id === id)).filter(Boolean) as Prodotto[]
    : prodotti.slice(0, 6);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: "var(--color-ink)", border: "1px solid var(--color-border)" }}
    >
      {/* Mini header */}
      <div className="flex items-center px-4 h-10" style={{ backgroundColor: "var(--color-smoke)", borderBottom: "1px solid var(--color-border)" }}>
        <span className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "var(--color-gold)" }}>InVinus</span>
      </div>

      <div className="p-5 space-y-5">
        {/* Hero consulente */}
        <div className="flex items-center gap-4">
          {fotoUrl ? (
            <img src={fotoUrl} alt="" className="w-16 h-16 rounded-full object-cover flex-shrink-0" style={{ border: "2px solid var(--color-gold)" }} />
          ) : (
            <div className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center text-xl font-bold"
              style={{ backgroundColor: "var(--color-ash)", color: "var(--color-gold)", border: "2px solid var(--color-border)" }}>
              {consulente.nome[0]}{consulente.cognome[0]}
            </div>
          )}
          <div>
            <p className="font-bold" style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}>
              {consulente.nome} {consulente.cognome}
            </p>
            <p className="text-xs" style={{ color: "var(--color-gold)" }}>{specialita || consulente.status}</p>
            {bio && <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--color-muted)" }}>{bio}</p>}
          </div>
        </div>

        {/* Messaggio */}
        {messaggio && (
          <p className="text-sm italic" style={{ color: "var(--color-pearl)", borderLeft: "2px solid var(--color-gold)", paddingLeft: "0.75rem" }}>
            "{messaggio}"
          </p>
        )}

        {/* Vini */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-gold)" }}>
            {viniSelezionati.length > 0 ? "Selezione personale" : "Dal catalogo"}
          </p>
          {viniToShow.map((p) => (
            <div key={p.id} className="flex justify-between items-center rounded-lg px-3 py-2"
              style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <div>
                <p className="text-xs font-medium" style={{ color: "var(--color-pearl)" }}>{p.nome}</p>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>{p.denominazione}</p>
              </div>
              <span className="text-xs px-1.5 rounded" style={{ backgroundColor: "var(--color-ash)", color: "var(--color-muted)" }}>{p.tipo}</span>
            </div>
          ))}
          {viniSelezionati.length === 0 && prodotti.length > 6 && (
            <p className="text-xs text-center" style={{ color: "var(--color-muted)" }}>+ altri {prodotti.length - 6} vini</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Form principale ────────────────────────────────────────────────────────────

export default function GestisciClient({
  consulente, prodotti, preferitiIds, userId,
}: {
  consulente: Consulente; prodotti: Prodotto[]; preferitiIds: number[]; userId: string;
}) {
  const [bio, setBio]                   = useState(consulente.bio);
  const [messaggio, setMessaggio]       = useState(consulente.messaggio_referral);
  const [specialita, setSpecialita]     = useState(consulente.specialita);
  const [fotoUrl, setFotoUrl]           = useState(consulente.foto_url);
  const [selezionati, setSelezionati]   = useState<number[]>(preferitiIds);
  const [salvato, setSalvato]           = useState(false);
  const [errore, setErrore]             = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [isPending, startTransition]    = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const link = `${BASE_URL}/ref/${consulente.link_referral}`;

  // Upload foto
  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    setErrore("");
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${userId}/profilo.${ext}`;
    const { error: upErr } = await supabase.storage.from("profili").upload(path, file, { upsert: true });
    if (upErr) { setErrore(upErr.message); setUploadingFoto(false); return; }
    const url = `${SUPABASE_URL}/storage/v1/object/public/profili/${path}?t=${Date.now()}`;
    // Salva subito foto_url su DB
    await supabase.rpc("aggiorna_profilo_consulente", {
      p_bio: bio, p_messaggio_referral: messaggio, p_specialita: specialita, p_foto_url: url,
    });
    setFotoUrl(url);
    setUploadingFoto(false);
  }

  // Toggle vino
  function toggleVino(id: number) {
    setSelezionati((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Salva tutto
  function handleSalva() {
    setErrore("");
    setSalvato(false);
    startTransition(async () => {
      const supabase = createClient();
      const [r1, r2] = await Promise.all([
        supabase.rpc("aggiorna_profilo_consulente", {
          p_bio: bio, p_messaggio_referral: messaggio, p_specialita: specialita,
        }),
        supabase.rpc("set_vini_preferiti", { p_prodotto_ids: selezionati }),
      ]);
      if (r1.error) { setErrore(r1.error.message); return; }
      if (r2.error) { setErrore(r2.error.message); return; }
      setSalvato(true);
      setTimeout(() => setSalvato(false), 3000);
    });
  }

  const inputStyle = { backgroundColor: "var(--color-ash)", color: "var(--color-pearl)", border: "1px solid var(--color-border)" };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

      {/* ── Colonna sinistra: form ── */}
      <div className="space-y-6">

        {/* Foto */}
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--color-pearl)" }}>Foto profilo</p>
          <div className="flex items-center gap-5">
            {fotoUrl ? (
              <img src={fotoUrl} alt="" className="w-20 h-20 rounded-full object-cover flex-shrink-0" style={{ border: "2px solid var(--color-gold)" }} />
            ) : (
              <div className="w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center text-2xl font-bold"
                style={{ backgroundColor: "var(--color-ash)", color: "var(--color-gold)", border: "2px dashed var(--color-border)" }}>
                {consulente.nome[0]}{consulente.cognome[0]}
              </div>
            )}
            <div className="space-y-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingFoto}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--color-gold)", color: "var(--color-ink)" }}
              >
                {uploadingFoto ? "Caricamento..." : fotoUrl ? "Cambia foto" : "Carica foto"}
              </button>
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>JPG, PNG, WebP · max 2MB · verrà mostrata in cerchio</p>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFotoChange} />
            </div>
          </div>
        </div>

        {/* Testi */}
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--color-pearl)" }}>Il tuo profilo</p>

          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>
              Specialità (es. "Esperta di rossi toscani")
            </label>
            <input type="text" value={specialita} onChange={(e) => setSpecialita(e.target.value)}
              maxLength={100} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}
              placeholder="Opzionale" />
          </div>

          <div>
            <label className="block text-xs mb-1 flex justify-between" style={{ color: "var(--color-muted)" }}>
              <span>Bio — raccontati in 2 righe</span>
              <span>{bio.length}/300</span>
            </label>
            <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value.slice(0, 300))}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none" style={inputStyle}
              placeholder="Appassionata di vino da vent'anni, organizzo serate di degustazione in Umbria..." />
          </div>

          <div>
            <label className="block text-xs mb-1 flex justify-between" style={{ color: "var(--color-muted)" }}>
              <span>Messaggio per i visitatori</span>
              <span>{messaggio.length}/500</span>
            </label>
            <textarea rows={2} value={messaggio} onChange={(e) => setMessaggio(e.target.value.slice(0, 500))}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none" style={inputStyle}
              placeholder="Ho selezionato per te i vini che amo di più..." />
          </div>
        </div>

        {/* Selezione vini */}
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: "var(--color-pearl)" }}>
              Vini in evidenza ({selezionati.length} selezionati)
            </p>
            {selezionati.length > 0 && (
              <button onClick={() => setSelezionati([])} className="text-xs" style={{ color: "var(--color-muted)" }}>
                Deseleziona tutti
              </button>
            )}
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--color-muted)" }}>
            Se non selezioni nulla, il visitatore vedrà il catalogo completo.
          </p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {prodotti.map((p) => {
              const attivo = selezionati.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleVino(p.id)}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-colors"
                  style={{
                    backgroundColor: attivo ? "rgba(200,168,92,0.12)" : "var(--color-ash)",
                    border: `1px solid ${attivo ? "var(--color-gold)" : "var(--color-border)"}`,
                  }}
                >
                  <div>
                    <span style={{ color: "var(--color-pearl)" }}>{p.nome}</span>
                    <span className="ml-2 text-xs" style={{ color: "var(--color-muted)" }}>{p.regioni?.nome}</span>
                  </div>
                  <span className="text-xs ml-2" style={{ color: attivo ? "var(--color-gold)" : "var(--color-muted)" }}>
                    {attivo ? "✓" : "+"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Link + Salva */}
        <div className="space-y-3">
          {errore && <p className="text-xs" style={{ color: "#ef4444" }}>{errore}</p>}
          <button
            onClick={handleSalva}
            disabled={isPending}
            className="w-full rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{
              backgroundColor: isPending ? "var(--color-ash)" : "var(--color-gold)",
              color: isPending ? "var(--color-muted)" : "var(--color-ink)",
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Salvataggio..." : salvato ? "Salvato ✓" : "Salva profilo"}
          </button>
          <p className="text-xs text-center" style={{ color: "var(--color-muted)" }}>
            Il tuo link:{" "}
            <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-gold)" }}>
              {link}
            </a>
          </p>
        </div>
      </div>

      {/* ── Colonna destra: preview live ── */}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>
          Preview — come la vedranno i tuoi contatti
        </p>
        <LandingPreview
          consulente={consulente} bio={bio} messaggio={messaggio}
          specialita={specialita} fotoUrl={fotoUrl}
          viniSelezionati={selezionati} prodotti={prodotti}
        />
      </div>
    </div>
  );
}
