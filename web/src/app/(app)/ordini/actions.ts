"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type RigaOrdine = {
  prodotto_id: number;
  quantita: number;
};

export type CreaOrdineResult =
  | { success: true; ordineId: number }
  | { success: false; error: string };

export async function creaOrdine(
  clienteId: number,
  tipo: string,
  righe: RigaOrdine[]
): Promise<CreaOrdineResult> {
  if (!clienteId || righe.length === 0) {
    return { success: false, error: "Dati mancanti" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("crea_ordine_incaricato", {
      p_cliente_id: clienteId,
      p_tipo:       tipo,
      p_righe:      righe,
    });

  if (error) return { success: false, error: error.message };

  revalidatePath("/ordini");
  revalidatePath("/dashboard");

  return { success: true, ordineId: data as number };
}
