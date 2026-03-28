// Dati mock — in Fase 1 arriveranno da GET /functions/v1/dashboard/:id
const MOCK_CONSULENTE = {
  nome: "Francesco",
  cognome: "Russo",
  status: "DIRECTOR",
  pvMese: 102,
  pvMin: 80,          // requisito attività DIRECTOR
  pvNextLevel: 150,   // requisito GV per AMBASSADOR (usato come target PV visivo)
  gvMese: 297,        // somma PV dei 4 consulenti nel downline
  gvNextLevel: 500,   // soglia GV per AMBASSADOR
  guadagniMese: {
    provvigionePersonale: 15.30,
    redditoresidualeL1: 22.40,
    redditoresidualeL2: 6.90,
    cab: 250.00,
    totale: 294.60,
  },
};

function ProgressBar({ value, max, color = "var(--color-gold)" }: { value: number; max: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="mt-3 h-1.5 w-full rounded-full" style={{ backgroundColor: "var(--color-ash)" }}>
      <div
        className="h-1.5 rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
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

export default function DashboardPage() {
  const d = MOCK_CONSULENTE;

  return (
    <div>
      {/* Titolo pagina */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}
        >
          Ciao, {d.nome}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          Marzo 2026 · <span style={{ color: "var(--color-gold)" }}>{d.status}</span>
        </p>
      </div>

      {/* 4 card KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* Card 1 — PV mese */}
        <Card>
          <CardLabel>PV mese</CardLabel>
          <CardValue>{d.pvMese}</CardValue>
          <ProgressBar value={d.pvMese} max={d.pvNextLevel} />
          <div className="mt-2 flex justify-between text-xs" style={{ color: "var(--color-muted)" }}>
            <span>Min attività: {d.pvMin}</span>
            <span>{d.pvMese}/{d.pvNextLevel} per promozione</span>
          </div>
        </Card>

        {/* Card 2 — GV mese */}
        <Card>
          <CardLabel>GV mese (team)</CardLabel>
          <CardValue>{d.gvMese}</CardValue>
          <ProgressBar value={d.gvMese} max={d.gvNextLevel} />
          <div className="mt-2 flex justify-between text-xs" style={{ color: "var(--color-muted)" }}>
            <span>4 consulenti attivi</span>
            <span>{d.gvMese}/{d.gvNextLevel} per prossimo livello</span>
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
            <p>Livelli residuale sbloccati: 5/8</p>
            <p>CAB attivo · Bonus Car no</p>
            <p style={{ color: "#22c55e" }}>● Attivo questo mese</p>
          </div>
        </Card>

        {/* Card 4 — Guadagni stimati */}
        <Card>
          <CardLabel>Guadagni stimati</CardLabel>
          <CardValue>€ {d.guadagniMese.totale.toFixed(2)}</CardValue>
          <div className="mt-3 space-y-1 text-xs" style={{ color: "var(--color-muted)" }}>
            <div className="flex justify-between">
              <span>Provvigione personale</span>
              <span>€ {d.guadagniMese.provvigionePersonale.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Residuale L1</span>
              <span>€ {d.guadagniMese.redditoresidualeL1.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Residuale L2</span>
              <span>€ {d.guadagniMese.redditoresidualeL2.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1" style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-gold)" }}>
              <span>CAB</span>
              <span>€ {d.guadagniMese.cab.toFixed(2)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
