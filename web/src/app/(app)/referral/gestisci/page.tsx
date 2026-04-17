import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GestisciClient from "./GestisciClient";

export const dynamic = "force-dynamic";

export default async function GestisciReferralPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: consulente } = await supabase
    .from("incaricati")
    .select("id, nome, cognome, link_referral, foto_url, bio, messaggio_referral, specialita, status")
    .eq("auth_user_id", user.id)
    .single();
  if (!consulente) redirect("/login");

  const [{ data: prodotti }, { data: preferiti }] = await Promise.all([
    supabase
      .from("prodotti")
      .select("id, nome, tipo, denominazione, regioni(nome)")
      .eq("disponibile", true)
      .order("nome"),
    supabase
      .from("incaricato_vini_preferiti")
      .select("prodotto_id, ordine")
      .eq("incaricato_id", consulente.id)
      .order("ordine"),
  ]);

  const preferitiIds = (preferiti ?? []).map((p) => p.prodotto_id);

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}
        >
          Il tuo profilo referral
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          Personalizza la tua pagina di invito — è il tuo biglietto da visita InVinus
        </p>
      </div>

      <GestisciClient
        consulente={{
          id:                  consulente.id,
          nome:                consulente.nome,
          cognome:             consulente.cognome,
          status:              consulente.status,
          link_referral:       consulente.link_referral ?? "",
          foto_url:            consulente.foto_url ?? null,
          bio:                 consulente.bio ?? "",
          messaggio_referral:  consulente.messaggio_referral ?? "",
          specialita:          consulente.specialita ?? "",
        }}
        prodotti={(prodotti ?? []) as { id: number; nome: string; tipo: string; denominazione: string; regioni: { nome: string } | null }[]}
        preferitiIds={preferitiIds}
        userId={user.id}
      />
    </div>
  );
}
