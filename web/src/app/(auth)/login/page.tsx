"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: "var(--color-ink)" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <h1
            className="text-4xl font-bold tracking-wide"
            style={{ fontFamily: "var(--font-playfair)", color: "var(--color-gold)" }}
          >
            InVinus
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            Vini Italiani Selezionati
          </p>
        </div>

        {/* Card form */}
        <div
          className="rounded-xl p-8"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <h2 className="mb-6 text-lg font-semibold" style={{ color: "var(--color-pearl)" }}>
            Accedi al tuo account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium" style={{ color: "var(--color-muted)" }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg px-4 py-3 text-sm outline-none"
                style={{
                  backgroundColor: "var(--color-ash)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-pearl)",
                }}
                placeholder="consulente@invinus.it"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium" style={{ color: "var(--color-muted)" }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg px-4 py-3 text-sm outline-none"
                style={{
                  backgroundColor: "var(--color-ash)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-pearl)",
                }}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg px-4 py-2 text-xs" style={{ backgroundColor: "#1a1000", color: "var(--color-gold)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg py-3 text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "var(--color-gold)", color: "var(--color-ink)" }}
            >
              {loading ? "Accesso in corso…" : "Accedi"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: "var(--color-muted)" }}>
          © 2026 InVinus — tutti i diritti riservati
        </p>
      </div>
    </div>
  );
}
