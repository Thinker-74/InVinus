"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CandidaturaForm({ referralCode }: { referralCode: string }) {
  const [aperto, setAperto]         = useState(false);
  const [nome, setNome]             = useState("");
  const [cognome, setCognome]       = useState("");
  const [email, setEmail]           = useState("");
  const [telefono, setTelefono]     = useState("");
  const [motivazione, setMotivazione] = useState("");
  const [errore, setErrore]         = useState("");
  const [successo, setSuccesso]     = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!nome.trim() || !cognome.trim() || !email.trim()) {
      setErrore("Nome, cognome ed email sono obbligatori");
      return;
    }
    setErrore("");
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("candida_consulente", {
        p_nome:          nome.trim(),
        p_cognome:       cognome.trim(),
        p_email:         email.trim(),
        p_telefono:      telefono.trim(),
        p_motivazione:   motivazione.trim(),
        p_referral_code: referralCode,
      });
      if (error) { setErrore(error.message); return; }
      setSuccesso(true);
    });
  }

  if (successo) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "rgba(200,168,92,0.08)", border: "1px solid var(--color-gold)" }}>
        <p className="text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)", color: "var(--color-gold)" }}>
          Candidatura inviata
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          Ti contatteremo presto per i prossimi passi.
        </p>
      </div>
    );
  }

  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        className="w-full rounded-2xl py-4 text-base font-semibold transition-opacity hover:opacity-80"
        style={{ backgroundColor: "var(--color-gold)", color: "var(--color-ink)" }}
      >
        Invia la tua candidatura
      </button>
    );
  }

  const inputStyle = {
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "var(--color-pearl)",
    border: "1px solid var(--color-border)",
  };

  return (
    <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {([
          ["Nome *",    nome,     setNome,     "text"],
          ["Cognome *", cognome,  setCognome,  "text"],
          ["Email *",   email,    setEmail,    "email"],
          ["Telefono",  telefono, setTelefono, "tel"],
        ] as const).map(([label, value, setter, type]) => (
          <div key={label}>
            <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>{label}</label>
            <input
              type={type}
              value={value}
              onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>
          Perché vuoi diventare consulente InVinus?
        </label>
        <textarea
          rows={3}
          value={motivazione}
          onChange={(e) => setMotivazione(e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
          style={inputStyle}
          placeholder="Racconta qualcosa di te..."
        />
      </div>

      {errore && <p className="text-xs" style={{ color: "#ef4444" }}>{errore}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => setAperto(false)}
          className="flex-1 rounded-xl py-2.5 text-sm"
          style={{ color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
        >
          Annulla
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-opacity"
          style={{
            backgroundColor: isPending ? "var(--color-ash)" : "var(--color-gold)",
            color: isPending ? "var(--color-muted)" : "var(--color-ink)",
            cursor: isPending ? "not-allowed" : "pointer",
          }}
        >
          {isPending ? "Invio..." : "Invia candidatura"}
        </button>
      </div>
    </div>
  );
}
