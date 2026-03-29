"use client";

type TeamMember = {
  id: number;
  nome: string;
  cognome: string;
  status: string;
  pv_mese: number;
  pv_min: number;
  livello: number;
  sponsor_id: number;
};

const STATUS_ORDER = [
  "STARTER", "APPRENTICE", "ADVISOR", "SUPERVISOR",
  "MANAGER", "SENIOR_MANAGER", "DIRECTOR", "EXECUTIVE",
];

function statusColor(status: string): string {
  const rank = STATUS_ORDER.indexOf(status);
  if (rank >= 6) return "var(--color-gold)";
  if (rank >= 4) return "#E8C97A";
  if (rank >= 2) return "var(--color-pearl)";
  return "var(--color-muted)";
}

function MemberCard({ member, sponsorNome }: { member: TeamMember; sponsorNome?: string }) {
  const attivo = member.pv_mese >= member.pv_min;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: "var(--color-pearl)" }}>
              {member.nome} {member.cognome}
            </span>
            <span
              className="text-xs font-medium rounded px-1.5 py-0.5"
              style={{
                color: statusColor(member.status),
                backgroundColor: "rgba(255,255,255,0.05)",
                border: `1px solid ${statusColor(member.status)}33`,
              }}
            >
              {member.status}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-3 flex-wrap">
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              {member.pv_mese} PV
              {member.pv_min > 0 && (
                <span> / {member.pv_min} min</span>
              )}
            </span>

            <span
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: attivo ? "#22c55e" : "#ef4444" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: attivo ? "#22c55e" : "#ef4444" }}
              />
              {attivo ? "Attivo" : "Inattivo"}
            </span>

            {sponsorNome && (
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                via {sponsorNome}
              </span>
            )}
          </div>
        </div>

        {/* PV bar */}
        {member.pv_min > 0 && (
          <div className="flex-shrink-0 text-right">
            <div className="w-16 h-1 rounded-full mt-1" style={{ backgroundColor: "var(--color-ash)" }}>
              <div
                className="h-1 rounded-full"
                style={{
                  width: `${Math.min((member.pv_mese / member.pv_min) * 100, 100)}%`,
                  backgroundColor: attivo ? "#22c55e" : "var(--color-gold)",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamClient({ members }: { members: TeamMember[] }) {
  const totali = members.length;
  const attivi = members.filter((m) => m.pv_mese >= m.pv_min).length;

  // Raggruppa per livello
  const maxLivello = Math.max(...members.map((m) => m.livello), 0);
  const levels = Array.from({ length: maxLivello }, (_, i) => i + 1);

  // Mappa id → nome per i sponsor
  const nomeById = Object.fromEntries(
    members.map((m) => [m.id, `${m.nome} ${m.cognome}`])
  );

  return (
    <div>
      {/* Riepilogo */}
      <div
        className="rounded-xl p-4 mb-6 flex items-center gap-6 flex-wrap"
        style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="text-center min-w-[3rem]">
          <p className="text-2xl font-bold" style={{ color: "var(--color-gold)" }}>{totali}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>nel team</p>
        </div>
        <div style={{ width: "1px", height: "2rem", backgroundColor: "var(--color-border)" }} />
        <div className="text-center min-w-[3rem]">
          <p className="text-2xl font-bold" style={{ color: "#22c55e" }}>{attivi}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>attivi</p>
        </div>
        <div style={{ width: "1px", height: "2rem", backgroundColor: "var(--color-border)" }} />
        <div className="text-center min-w-[3rem]">
          <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>{totali - attivi}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>inattivi</p>
        </div>
      </div>

      {/* Livelli */}
      <div className="space-y-6">
        {levels.map((liv) => {
          const gruppo = members.filter((m) => m.livello === liv);
          const attiviGruppo = gruppo.filter((m) => m.pv_mese >= m.pv_min).length;

          return (
            <div key={liv}>
              {/* Header livello */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--color-ash)",
                    color: liv === 1 ? "var(--color-gold)" : "var(--color-muted)",
                  }}
                >
                  L{liv}
                </div>
                <span className="text-sm font-medium" style={{ color: "var(--color-pearl)" }}>
                  {liv === 1 ? "Diretti" : `Livello ${liv}`}
                </span>
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {gruppo.length} {gruppo.length === 1 ? "persona" : "persone"} · {attiviGruppo} {attiviGruppo === 1 ? "attiva" : "attive"}
                </span>
              </div>

              {/* Cards */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {gruppo.map((m) => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    sponsorNome={liv > 1 ? nomeById[m.sponsor_id] : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
