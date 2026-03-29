import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientiClient from "./ClientiClient";

export default async function ClientiPage() {
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

  const { data: clienti } = await supabase
    .rpc("get_clienti_consulente", { p_consulente_id: consulente.id });

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-playfair)", color: "var(--color-pearl)" }}
        >
          Clienti
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          {clienti?.length ?? 0} clienti · {consulente.nome}
        </p>
      </div>

      <ClientiClient clienti={clienti ?? []} />
    </div>
  );
}
