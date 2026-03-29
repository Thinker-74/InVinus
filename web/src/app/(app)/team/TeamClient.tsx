"use client";

import { useState } from "react";

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

function ActiveBadge({ attivo }: { attivo: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: attivo ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        color: attivo ? "#22c55e" : "#ef4444",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: attivo ? "#22c55e" : "#ef4444" }} />
      {attivo ? "Attivo" : "Inattivo"}
    </span>
  );
}

function MemberCard({
  member,
  children,
  depth,
  expanded,
  onToggle,
}: {
  member: TeamMember;
  children: TeamMember[];
  depth: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const attivo = member.pv_mese >= member.pv_min;
  const hasChildren = children.length > 0;

  return (
    <div style={{ marginLeft: depth > 0 ? `${depth * 20}px` : 0 }}>
      <div
        className="rounded-xl p-4 transition-colors"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          marginBottom: "0.5rem",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left: name + status */}
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
                  border: `1px solid ${statusColor(member.status)}40`,
                }}
              >
                {member.status}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                {member.pv_mese} PV
                {member.pv_min > 0 && (
                  <span style={{ color: "var(--color-muted)" }}> / {member.pv_min} min</span>
                )}
              </span>
              <ActiveBadge attivo={attivo} />
            </div>
          </div>

          {/* Right: expand button */}
          {hasChildren && (
            <button
              onClick={onToggle}
              className="flex-shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition-colors"
              style={{
                color: "var(--color-muted)",
                border: "1px solid var(--color-border)",
                backgroundColor: expanded ? "var(--color-ash)" : "transparent",
              }}
            >
              <span>{children.length}</span>
              <span
                style={{
                  display: "inline-block",
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              >
                ▾
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamClient({ members }: { members: TeamMember[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([
    // Espandi tutti i L1 di default
    ...members.filter((m) => m.livello === 1).map((m) => m.id),
  ]));

  const childrenOf = (parentId: number) =>
    members.filter((m) => m.sponsor_id === parentId);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totali = members.length;
  const attivi = members.filter((m) => m.pv_mese >= m.pv_min).length;
  const diretti = members.filter((m) => m.livello === 1);

  function renderNode(member: TeamMember, depth: number): React.ReactNode {
    const children = childrenOf(member.id);
    const isExpanded = expanded.has(member.id);
    return (
      <div key={member.id}>
        <MemberCard
          member={member}
          children={children}
          depth={depth}
          expanded={isExpanded}
          onToggle={() => toggle(member.id)}
        />
        {isExpanded && children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div>
      {/* Riepilogo */}
      <div
        className="rounded-xl p-4 mb-6 flex items-center gap-6"
        style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: "var(--color-gold)" }}>{totali}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>nel team</p>
        </div>
        <div style={{ width: "1px", height: "2rem", backgroundColor: "var(--color-border)" }} />
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: "#22c55e" }}>{attivi}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>attivi</p>
        </div>
        <div style={{ width: "1px", height: "2rem", backgroundColor: "var(--color-border)" }} />
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: "var(--color-pearl)" }}>{totali - attivi}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>inattivi</p>
        </div>
        <div style={{ width: "1px", height: "2rem", backgroundColor: "var(--color-border)" }} />
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: "var(--color-pearl)" }}>{diretti.length}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>diretti L1</p>
        </div>
      </div>

      {/* Albero */}
      <div>
        {diretti.map((member) => renderNode(member, 0))}
      </div>
    </div>
  );
}
