import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { calcolaProvvigioniMensili } from "@/lib/provvigioni/index";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  // Verifica autenticazione admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { data: consulente } = await supabase
    .from("consulenti")
    .select("ruolo")
    .eq("auth_user_id", user.id)
    .single();
  if (consulente?.ruolo !== "admin") {
    return NextResponse.json({ error: "Accesso riservato ad admin" }, { status: 403 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: "DATABASE_URL non configurato" }, { status: 500 });
  }
  const { anno, mese } = await req.json() as { anno: number; mese: number };
  if (!anno || !mese) {
    return NextResponse.json({ error: "anno e mese obbligatori" }, { status: 400 });
  }

  const pool = new Pool({ connectionString: dbUrl });
  try {
    const result = await calcolaProvvigioniMensili(pool, anno, mese);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await pool.end();
  }
}
