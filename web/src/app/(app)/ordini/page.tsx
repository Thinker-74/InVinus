import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OrdiniClient from "./OrdiniClient";

export default async function OrdiniPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: consulente } = await supabase
    .from("consulenti")
    .select("id, nome")
    .eq("auth_user_id", user.id)
    .single();

  if (!consulente) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-muted)" }}>
        Nessun consulente associato a questo account.
      </div>
    );
  }

  // Ultimi 30 ordini del consulente
  const { data: ordini } = await supabase
    .from("ordini")
    .select("id, data, stato, tipo, totale, pv_generati, clienti(nome, cognome)")
    .eq("consulente_id", consulente.id)
    .order("data", { ascending: false })
    .limit(30);

  // Lista clienti e prodotti per il form
  const [{ data: clienti }, { data: prodotti }] = await Promise.all([
    supabase.from("clienti").select("id, nome, cognome").order("nome"),
    supabase.from("prodotti").select("id, nome, prezzo_pubblico, pv_valore")
      .eq("disponibile", true).order("nome"),
  ]);

  const now  = new Date();
  const mese = now.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}
        >
          Ordini
        </h1>
        <p className="text-sm mt-1 capitalize" style={{ color: "var(--color-muted)" }}>
          {mese} · {consulente.nome}
        </p>
      </div>

      <OrdiniClient
        ordini={(ordini ?? []) as Parameters<typeof OrdiniClient>[0]["ordini"]}
        clienti={clienti ?? []}
        prodotti={(prodotti ?? []) as Parameters<typeof OrdiniClient>[0]["prodotti"]}
      />
    </div>
  );
}
