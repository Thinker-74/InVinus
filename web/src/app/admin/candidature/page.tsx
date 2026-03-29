import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CandidatureClient from "./CandidatureClient";

export default async function AdminCandidaturePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: candidature } = await supabase
    .from("candidature")
    .select("id, nome, cognome, email, telefono, motivazione, sponsor_referral_code, stato, created_at, note_admin")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}>
          Candidature
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          {(candidature ?? []).filter((c) => c.stato === "in_attesa").length} in attesa di approvazione
        </p>
      </div>
      <CandidatureClient candidature={candidature ?? []} />
    </div>
  );
}
