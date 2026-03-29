"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://invinus.it";

export default function ReferralCard({ initialCode }: { initialCode: string }) {
  const [code, setCode]             = useState(initialCode);
  const [editing, setEditing]       = useState(false);
  const [draft, setDraft]           = useState(initialCode);
  const [errore, setErrore]         = useState("");
  const [copied, setCopied]         = useState(false);
  const [isPending, startTransition] = useTransition();

  const link = `${BASE_URL}/ref/${code}`;

  function handleCopy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleSave() {
    if (!draft.trim()) { setErrore("Il codice non può essere vuoto"); return; }
    setErrore("");
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("set_referral_code", { p_code: draft.trim() });
      if (error) { setErrore(error.message); return; }
      setCode(draft.trim());
      setEditing(false);
    });
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--color-muted)" }}>
        Il tuo link referral
      </p>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>
              Codice personalizzato (lettere, numeri, - e _)
            </label>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: "var(--color-ash)",
                color: "var(--color-pearl)",
                border: "1px solid var(--color-border)",
              }}
            />
            <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
              {BASE_URL}/ref/<strong style={{ color: "var(--color-gold)" }}>{draft || "…"}</strong>
            </p>
          </div>
          {errore && <p className="text-xs" style={{ color: "#ef4444" }}>{errore}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setEditing(false); setDraft(code); setErrore(""); }}
              className="flex-1 rounded-lg py-2 text-xs"
              style={{ color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 rounded-lg py-2 text-xs font-semibold transition-opacity"
              style={{
                backgroundColor: isPending ? "var(--color-ash)" : "var(--color-gold)",
                color: isPending ? "var(--color-muted)" : "var(--color-ink)",
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? "Salvo..." : "Salva"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--color-ash)", border: "1px solid var(--color-border)" }}
          >
            <span className="flex-1 text-xs truncate" style={{ color: "var(--color-pearl)" }}>
              {BASE_URL}/ref/<strong style={{ color: "var(--color-gold)" }}>{code}</strong>
            </span>
            <button
              onClick={handleCopy}
              className="text-xs flex-shrink-0 transition-colors"
              style={{ color: copied ? "#22c55e" : "var(--color-muted)" }}
            >
              {copied ? "Copiato ✓" : "Copia"}
            </button>
          </div>
          <button
            onClick={() => { setDraft(code); setEditing(true); }}
            className="text-xs transition-opacity hover:opacity-70"
            style={{ color: "var(--color-muted)" }}
          >
            Modifica codice →
          </button>
        </div>
      )}
    </div>
  );
}
