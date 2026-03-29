import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CandidaturaForm from "./CandidaturaForm";

function TempBadge({ temp }: { temp: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "var(--color-ash)", color: "var(--color-muted)" }}>
      {temp}
    </span>
  );
}

export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  // Trova il consulente dal codice
  const { data: rows } = await supabase.rpc("get_consulente_by_referral", { p_code: code });
  const consulente = rows?.[0];
  if (!consulente) notFound();

  // Catalogo prodotti con join regione
  const { data: prodotti } = await supabase
    .from("prodotti")
    .select("id, nome, tipo, denominazione, annata, prezzo_pubblico, alcol, temp_servizio_min, temp_servizio_max, regioni(nome)")
    .eq("disponibile", true)
    .order("nome");

  type Prodotto = NonNullable<typeof prodotti>[number] & { regioni: { nome: string } | null };
  const prodottiTyped = (prodotti ?? []) as Prodotto[];
  const regioni = [...new Set(prodottiTyped.map((p) => p.regioni?.nome ?? "—"))].sort();

  return (
    <div style={{ backgroundColor: "var(--color-ink)", minHeight: "100vh", color: "var(--color-pearl)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 h-16"
        style={{ backgroundColor: "var(--color-smoke)", borderBottom: "1px solid var(--color-border)" }}
      >
        <span className="text-xl font-bold tracking-wide" style={{ fontFamily: "var(--font-playfair)", color: "var(--color-gold)" }}>
          InVinus
        </span>
        <span className="text-xs" style={{ color: "var(--color-muted)" }}>
          Un nuovo modo di vivere il vino
        </span>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-14">

        {/* Hero — attribuzione consulente */}
        <section className="text-center space-y-3">
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>Selezione curata per te da</p>
          <h1 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "var(--color-gold)" }}>
            {consulente.nome} {consulente.cognome}
          </h1>
          <p className="text-base" style={{ color: "var(--color-muted)" }}>
            Consulente InVinus · {consulente.status}
          </p>
        </section>

        {/* Catalogo */}
        <section>
          <h2 className="text-xl font-semibold mb-6" style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}>
            Il catalogo
          </h2>

          {regioni.map((regione) => (
            <div key={regione} className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-gold)" }}>
                {regione}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {prodottiTyped.filter((p) => (p.regioni?.nome ?? "—") === regione).map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl p-4"
                    style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm leading-snug" style={{ color: "var(--color-pearl)" }}>
                          {p.nome}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                          {p.denominazione}{p.annata ? ` · ${p.annata}` : ""}
                        </p>
                      </div>
                      <span className="text-sm font-semibold flex-shrink-0" style={{ color: "var(--color-gold)" }}>
                        € {Number(p.prezzo_pubblico).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <TempBadge temp={`${p.alcol}%`} />
                      {p.temp_servizio_min && <TempBadge temp={`${p.temp_servizio_min}-${p.temp_servizio_max}°C`} />}
                      <TempBadge temp={p.tipo} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <p className="text-sm mt-4" style={{ color: "var(--color-muted)" }}>
            Per ordinare contatta direttamente {consulente.nome} oppure candidati come consulente per accedere all&apos;acquisto diretto.
          </p>
        </section>

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--color-border)" }} />

        {/* Sezione candidatura */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}>
              Scopri l&apos;opportunità InVinus
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
              Diventa consulente InVinus: seleziona vini italiani d&apos;eccellenza, organizza serate di degustazione,
              costruisci il tuo network. Guadagni basati esclusivamente sulla tua attività.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            {[
              ["Serate", "Organizza degustazioni a casa tua o dei tuoi contatti"],
              ["Catalogo", "30+ etichette da 4 regioni italiane selezionate"],
              ["Network", "Costruisci il tuo team, guadagna sul gruppo"],
            ].map(([titolo, desc]) => (
              <div
                key={titolo}
                className="rounded-xl p-4"
                style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <p className="font-semibold text-sm mb-1" style={{ color: "var(--color-gold)" }}>{titolo}</p>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>{desc}</p>
              </div>
            ))}
          </div>

          <CandidaturaForm referralCode={code} />
        </section>

        {/* Footer */}
        <footer className="text-center text-xs pb-8" style={{ color: "var(--color-muted)" }}>
          © InVinus · I guadagni dipendono esclusivamente dall&apos;attività di ogni singolo consulente.
        </footer>
      </main>
    </div>
  );
}
