import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TeamClient from "./TeamClient";

const MESI_IT = [
  "", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export default async function TeamPage() {
  const now  = new Date();
  const anno = now.getFullYear();
  const mese = now.getMonth() + 1;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: consulente } = await supabase
    .from("incaricati")
    .select("id, nome")
    .eq("auth_user_id", user.id)
    .single();

  if (!consulente) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-muted)" }}>
        Nessun incaricato associato a questo account.
      </div>
    );
  }

  const { data, error } = await supabase
    .rpc("get_team_incaricato", {
      p_incaricato_id: consulente.id,
      p_anno:          anno,
      p_mese:          mese,
    });

  if (error) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-muted)" }}>
        Errore: {error.message}
      </div>
    );
  }

  const members = (data ?? []) as {
    id: number;
    nome: string;
    cognome: string;
    status: string;
    pv_mese: number;
    pv_min: number;
    livello: number;
    sponsor_id: number;
  }[];

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}
        >
          Il tuo team
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          {MESI_IT[mese]} {anno} · downline di {consulente.nome}
        </p>
      </div>

      {members.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Non hai ancora incaricati nel tuo team.
          </p>
        </div>
      ) : (
        <TeamClient members={members} />
      )}
    </div>
  );
}
