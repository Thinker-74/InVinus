"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function aggiungiCliente(
  nome: string,
  cognome: string,
  email: string,
  telefono: string
): Promise<{ success: true; id: number } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aggiungi_cliente_incaricato", {
    p_nome:     nome,
    p_cognome:  cognome,
    p_email:    email,
    p_telefono: telefono,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/clienti");
  return { success: true, id: data as number };
}
