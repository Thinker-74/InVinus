import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Setta cookie referral se visita /ref/[code] (dura 30 giorni)
  if (pathname.startsWith("/ref/")) {
    const code = pathname.split("/")[2];
    if (code) {
      supabaseResponse.cookies.set("invinus_referral", code, {
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        sameSite: "lax",
      });
    }
  }

  // Route pubbliche
  const isPublic =
    pathname === "/login" ||
    pathname === "/" ||
    pathname.startsWith("/ref/");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Protezione /admin: solo ruolo admin
  if (user && pathname.startsWith("/admin")) {
    const { data: consulente } = await supabase
      .from("consulenti")
      .select("ruolo")
      .eq("auth_user_id", user.id)
      .single();

    if (consulente?.ruolo !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Setta cookie ruolo per la sidebar (httpOnly: false → leggibile da JS client)
    supabaseResponse.cookies.set("invinus_ruolo", "admin", {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 ore, viene rinnovato ad ogni navigazione admin
    });
  }

  // Per utenti autenticati non-admin, assicura che il cookie ruolo rifletta "consulente"
  if (user && !pathname.startsWith("/admin") && !isPublic) {
    const currentRuolo = request.cookies.get("invinus_ruolo")?.value;
    if (!currentRuolo) {
      // Fetch ruolo una volta sola e cachelo in cookie
      const { data: consulente } = await supabase
        .from("consulenti")
        .select("ruolo")
        .eq("auth_user_id", user.id)
        .single();
      if (consulente) {
        supabaseResponse.cookies.set("invinus_ruolo", consulente.ruolo ?? "consulente", {
          path: "/",
          sameSite: "lax",
          maxAge: 60 * 60 * 8,
        });
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
