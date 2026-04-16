# 14 — Allineamento struttura produzione (ground truth)

> Fotografia dello stato reale del progetto InVinus al 2026-04-16.
> Compilato da Claude Code leggendo il codice. Le parti marcate
> [DA VERIFICARE SU SUPABASE] richiedono esecuzione query dall'utente.

---

## 1. Schema DB — tabelle chiave

### 1.1 Tabella `consulenti`

Estratto da `db/schema.sql` + ALTER da `db/migrations/001_security_fixes.sql`:

```sql
CREATE TABLE consulenti (
  id                        SERIAL PRIMARY KEY,
  nome                      VARCHAR(100) NOT NULL,
  cognome                   VARCHAR(100) NOT NULL,
  email                     VARCHAR(200) NOT NULL UNIQUE,
  telefono                  VARCHAR(20),
  codice_fiscale            VARCHAR(16) UNIQUE,
  sponsor_id                INT REFERENCES consulenti(id),     -- NULL = top of tree
  status                    status_consulente NOT NULL DEFAULT 'STARTER',
  status_max                status_consulente NOT NULL DEFAULT 'STARTER',
  pv_mese_corrente          DECIMAL(10,2) NOT NULL DEFAULT 0,
  gv_mese_corrente          DECIMAL(10,2) NOT NULL DEFAULT 0,
  attivo                    BOOLEAN NOT NULL DEFAULT TRUE,
  formazione_completata     BOOLEAN NOT NULL DEFAULT FALSE,
  link_referral             VARCHAR(100) UNIQUE,
  stripe_account_id         VARCHAR(100),
  stato_account             stato_account_consulente NOT NULL DEFAULT 'attivo',
  data_iscrizione           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_ultimo_status_change TIMESTAMPTZ,
  approvato_da              INT REFERENCES consulenti(id),
  approvato_il              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_status_max CHECK (status_max >= status)
);
```

**Nota: la colonna `ruolo` e `auth_user_id` NON sono presenti in `db/schema.sql`.**
Esistono però nel codice applicativo (lette da `proxy.ts` e dalla dashboard):
- `web/src/proxy.ts` esegue `.select("ruolo").eq("auth_user_id", user.id)` sulla tabella `consulenti`
- `web/src/app/(app)/dashboard/page.tsx` esegue `.select("id, link_referral").eq("auth_user_id", user.id)`

Queste colonne devono essere state aggiunte manualmente su Supabase o tramite migration non presente nel repo.

Check automatici:
- Colonna che collega a auth.users: `auth_user_id` — PRESENTE NEL CODICE, ASSENTE DA schema.sql
- Campo ruolo admin/consulente: `ruolo` (VARCHAR presunto) — PRESENTE NEL CODICE, ASSENTE DA schema.sql
- Campi location (città, regione, cap): NON PRESENTI
- Campi foto: NESSUNO
- Come si distingue attivo/inattivo/pending: campo `attivo BOOLEAN` (soddisfa PV requisito mensile) + campo `stato_account stato_account_consulente` (enum: `attivo`, `sospeso`, `dormiente`, `cancellato`)
- Self-reference sponsor: `sponsor_id` INT REFERENCES consulenti(id)

### 1.2 Tabella `candidature`

Non definita in `db/schema.sql`. Schema ricostruito da `information_schema` di produzione:

```sql
-- Ricostruito da information_schema.columns + pg_constraint (produzione 2026-04-16)
CREATE TABLE candidature (
  id                    SERIAL PRIMARY KEY,
  nome                  VARCHAR(100) NOT NULL,
  cognome               VARCHAR(100) NOT NULL,
  email                 VARCHAR(200) NOT NULL,         -- no UNIQUE constraint
  telefono              VARCHAR(20),
  motivazione           TEXT,
  sponsor_referral_code VARCHAR(100) REFERENCES consulenti(link_referral) ON UPDATE CASCADE,
  stato                 stato_candidatura NOT NULL DEFAULT 'in_attesa',
  note_admin            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Check automatici:
- Stati possibili: enum `stato_candidatura` — valore seed `'in_attesa'`; altri valori dell'enum (es. `approvata`, `rifiutata`) da verificare con `SELECT enum_range(NULL::stato_candidatura)`
- Campo email: `email VARCHAR(200) NOT NULL` — **senza UNIQUE constraint** (attenzione: duplicati possibili)
- Campo CF: NON PRESENTE
- Collegamento a consulenti dopo approvazione: la FK è `sponsor_referral_code → consulenti.link_referral`; il meccanismo di creazione del record `consulenti` post-approvazione è nella UI admin (`web/src/app/admin/candidature/`) — non c'è trigger automatico nel DB
- Campo `note_admin`: PRESENTE (nullable)

### 1.3 Tabella `clienti`

```sql
CREATE TABLE clienti (
  id                   SERIAL PRIMARY KEY,
  nome                 VARCHAR(100) NOT NULL,
  cognome              VARCHAR(100) NOT NULL,
  email                VARCHAR(200) UNIQUE,
  telefono             VARCHAR(20),
  consulente_id        INT REFERENCES consulenti(id),
  data_primo_acquisto  TIMESTAMPTZ,
  segmento             VARCHAR(50),   -- wine_lover, horeca, regalo
  note                 TEXT,
  gdpr_consenso        BOOLEAN NOT NULL DEFAULT FALSE,
  gdpr_data_consenso   TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Check automatici:
- FK allo sponsor/consulente: `consulente_id` (chi ha portato il cliente)
- user_id auth: NON PRESENTE
- I clienti hanno login oggi? NO — nessuna colonna `auth_user_id` nella tabella clienti

### 1.4 Tabella `qualifiche`

```sql
CREATE TABLE qualifiche (
  status               status_consulente PRIMARY KEY,
  pv_min               INT NOT NULL DEFAULT 0,
  gv_min               INT NOT NULL DEFAULT 0,
  provvigione_pers     DECIMAL(5,4) NOT NULL DEFAULT 0.15,
  residuale_l1         DECIMAL(5,4) NOT NULL DEFAULT 0,
  residuale_l2         DECIMAL(5,4) NOT NULL DEFAULT 0,
  residuale_l3         DECIMAL(5,4) NOT NULL DEFAULT 0,
  residuale_l4         DECIMAL(5,4) NOT NULL DEFAULT 0,
  residuale_l5         DECIMAL(5,4) NOT NULL DEFAULT 0,
  residuale_l6         DECIMAL(5,4) NOT NULL DEFAULT 0,
  residuale_l7         DECIMAL(5,4) NOT NULL DEFAULT 0,
  residuale_l8         DECIMAL(5,4) NOT NULL DEFAULT 0,
  cab_importo          DECIMAL(6,2) NOT NULL DEFAULT 0,
  ha_bonus_car         BOOLEAN NOT NULL DEFAULT FALSE,
  ha_global_pool       BOOLEAN NOT NULL DEFAULT FALSE
);
```

Valori seed reali (da `db/schema.sql`):

| status           | pv_min | gv_min  | prov_pers | l1   | l2   | l3   | l4   | l5   | l6   | l7   | l8   | cab  | car   | pool  |
|------------------|--------|---------|-----------|------|------|------|------|------|------|------|------|------|-------|-------|
| STARTER          | 0      | 0       | 0.15      | 0    | 0    | 0    | 0    | 0    | 0    | 0    | 0    | 0    | false | false |
| APPRENTICE       | 50     | 50      | 0.15      | 0.60 | 0    | 0    | 0    | 0    | 0    | 0    | 0    | 0    | false | false |
| ADVISOR          | 50     | 150     | 0.15      | 0.30 | 0.30 | 0    | 0    | 0    | 0    | 0    | 0    | 0    | false | false |
| SUPERVISOR       | 50     | 500     | 0.15      | 0.20 | 0.20 | 0.20 | 0    | 0    | 0    | 0    | 0    | 0    | false | false |
| TEAM_COORDINATOR | 50     | 1500    | 0.15      | 0.15 | 0.15 | 0.15 | 0.15 | 0    | 0    | 0    | 0    | 0    | false | false |
| MANAGER          | 80     | 15000   | 0.15      | 0.15 | 0.15 | 0.15 | 0.15 | 0.03 | 0    | 0    | 0    | 0    | false | false |
| DIRECTOR         | 100    | 50000   | 0.15      | 0.15 | 0.15 | 0.15 | 0.15 | 0.03 | 0.02 | 0    | 0    | 1.00 | false | false |
| AMBASSADOR       | 120    | 100000  | 0.15      | 0.15 | 0.15 | 0.15 | 0.15 | 0.03 | 0.02 | 0.01 | 0    | 2.00 | true  | false |
| GOLDEN           | 150    | 100000  | 0.15      | 0.15 | 0.15 | 0.15 | 0.15 | 0.03 | 0.02 | 0.01 | 0.01 | 3.00 | true  | true  |

### 1.5 Tabella `provvigioni_mensili`

```sql
CREATE TABLE provvigioni_mensili (
  id                    SERIAL PRIMARY KEY,
  consulente_id         INT NOT NULL REFERENCES consulenti(id),
  anno                  SMALLINT NOT NULL,
  mese                  SMALLINT NOT NULL CHECK (mese BETWEEN 1 AND 12),
  pv_mese               DECIMAL(10,2) NOT NULL DEFAULT 0,
  gv_mese               DECIMAL(10,2) NOT NULL DEFAULT 0,
  status_al_calcolo     status_consulente NOT NULL,
  era_attivo            BOOLEAN NOT NULL DEFAULT FALSE,
  provvigione_personale DECIMAL(10,2) NOT NULL DEFAULT 0,
  reddito_residuale     DECIMAL(10,2) NOT NULL DEFAULT 0,
  residuale_dettaglio   JSONB,   -- {"l1": 120.50, "l2": 45.00, ...}
  cab_bonus             DECIMAL(10,2) NOT NULL DEFAULT 0,
  bonus_car             DECIMAL(10,2) NOT NULL DEFAULT 0,
  global_pool           DECIMAL(10,2) NOT NULL DEFAULT 0,
  totale                DECIMAL(10,2) NOT NULL DEFAULT 0,
  stato                 stato_pagamento_prov NOT NULL DEFAULT 'calcolato',
  data_calcolo          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_pagamento        TIMESTAMPTZ,
  UNIQUE(consulente_id, anno, mese)
);
```

### 1.6 Auth e ruoli

- File che legge il ruolo: `web/src/proxy.ts`
- Meccanismo: colonna `consulenti.ruolo` (valore atteso: `"admin"` o `"consulente"`) + colonna `consulenti.auth_user_id` che collega all'utente Supabase Auth
- Query/RPC usata da proxy e dashboard: query diretta PostgREST `.from("consulenti").select("ruolo").eq("auth_user_id", user.id).single()`
- Snippet rilevante (da `web/src/proxy.ts`):

```typescript
const { data: consulente } = await supabase
  .from("consulenti")
  .select("ruolo")
  .eq("auth_user_id", user.id)
  .single();

if (consulente?.ruolo !== "admin") {
  // redirect a /dashboard
}

// Cookie impostato per la sidebar:
supabaseResponse.cookies.set("invinus_ruolo", "admin", {
  path: "/",
  sameSite: "lax",
  maxAge: 60 * 60 * 8,
});
```

**DISCREPANZA CRITICA:** Le colonne `auth_user_id` e `ruolo` sono usate dal codice applicativo
ma non sono definite in `db/schema.sql`. Devono essere presenti in produzione su Supabase
ma non sono versionabili tramite il file di schema nel repo.

---

## 2. Frontend — albero route

Output di `find web/src/app -type f \( -name "*.tsx" -o -name "*.ts" \) | sort`:

```
web/src/app/admin/candidature/CandidatureClient.tsx
web/src/app/admin/candidature/page.tsx
web/src/app/admin/consulenti/[id]/page.tsx
web/src/app/admin/consulenti/page.tsx
web/src/app/admin/dashboard/page.tsx
web/src/app/admin/layout.tsx
web/src/app/admin/provvigioni/page.tsx
web/src/app/api/admin/calcola-provvigioni/route.ts
web/src/app/(app)/catalogo/CatalogoClient.tsx
web/src/app/(app)/catalogo/page.tsx
web/src/app/(app)/clienti/actions.ts
web/src/app/(app)/clienti/ClientiClient.tsx
web/src/app/(app)/clienti/[id]/page.tsx
web/src/app/(app)/clienti/page.tsx
web/src/app/(app)/dashboard/page.tsx
web/src/app/(app)/dashboard/ReferralCard.tsx
web/src/app/(app)/layout.tsx
web/src/app/(app)/ordini/actions.ts
web/src/app/(app)/ordini/OrdiniClient.tsx
web/src/app/(app)/ordini/page.tsx
web/src/app/(app)/provvigioni/page.tsx
web/src/app/(app)/referral/gestisci/GestisciClient.tsx
web/src/app/(app)/referral/gestisci/page.tsx
web/src/app/(app)/team/page.tsx
web/src/app/(app)/team/TeamClient.tsx
web/src/app/(auth)/login/page.tsx
web/src/app/global-error.tsx
web/src/app/layout.tsx
web/src/app/not-found.tsx
web/src/app/page.tsx
web/src/app/ref/[code]/CandidaturaForm.tsx
web/src/app/ref/[code]/page.tsx
web/src/components/Sidebar.tsx
web/src/lib/provvigioni/engine.ts
web/src/lib/provvigioni/index.ts
web/src/lib/provvigioni/repository.ts
web/src/lib/provvigioni/types.ts
web/src/lib/supabase/client.ts
web/src/lib/supabase/server.ts
web/src/proxy.ts
web/src/types/supabase.ts
```

Check:
- Esiste già `web/src/app/ref/`? SI — `web/src/app/ref/[code]/page.tsx` + `CandidaturaForm.tsx`
- Cosa fa `web/src/app/page.tsx` (la home)? Redirect immediato a `/dashboard` (nessuna landing page pubblica)
- Pagine pubbliche (non-auth) esistenti: `/login` (`(auth)/login/page.tsx`), `/` (redirect), `/ref/[code]` (pagina landing referral + form candidatura)
- Layout principale in `web/src/app/layout.tsx`: usa Inter + Playfair Display (Google Fonts), dark luxury coerente. Non carica esplicitamente un tema dark nel layout root — il tema dark luxury è gestito tramite variabili CSS (`--color-gold`, `--color-pearl`, `--color-surface`, `--color-muted`, `--color-border`, `--color-ash`) applicate nei singoli componenti

---

## 3. proxy.ts

Contenuto completo (`web/src/proxy.ts`):

```typescript
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

    supabaseResponse.cookies.set("invinus_ruolo", "admin", {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
    });
  }

  if (user && !pathname.startsWith("/admin") && !isPublic) {
    const currentRuolo = request.cookies.get("invinus_ruolo")?.value;
    if (!currentRuolo) {
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
```

Check:
- Matcher config: esclude static assets, immagini, favicon e file con estensione grafica — intercetta tutto il resto
- Setta cookie custom: SI — `invinus_referral` (visita `/ref/[code]`, 30 giorni) e `invinus_ruolo` (`"admin"` o valore da DB, 8 ore)
- Gestisce redirect per auth: SI — non-auth su route protette → `/login`; utente loggato su `/login` → `/dashboard`; non-admin su `/admin` → `/dashboard`

---

## 4. Route Handler provvigioni (con errore ENOTFOUND)

File: `web/src/app/api/admin/calcola-provvigioni/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { calcolaProvvigioniMensili } from "@/lib/provvigioni/index";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
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
```

Check:
- pg Pool creato a livello: REQUEST (creato dentro il handler POST ad ogni chiamata, `pool.end()` nel finally)
- DATABASE_URL letta come: `process.env.DATABASE_URL` direttamente
- Dove viene importato l'engine TypeScript: `@/lib/provvigioni/index` (che re-esporta `calcolaProvvigioniMensili` da `engine.ts`)

**Causa ENOTFOUND su Vercel:** la `DATABASE_URL` attuale punta all'host diretto Supabase
(`db.<ref>.supabase.co:5432`) che non è raggiungibile da Vercel (serverless). Serve il
connection string del **Transaction Pooler** (`aws-0-eu-central-1.pooler.supabase.com:6543`
con `pgbouncer=true`).

---

## 5. Engine provvigioni

File in `web/src/lib/provvigioni/`:

| File | Righe | Descrizione |
|------|-------|-------------|
| `types.ts` | 151 | Definisce tutti i tipi TypeScript del dominio: `StatusConsulente`, `Qualifica`, `ConsulenteMese`, `StornoRecord`, `ProvvigioneResult`, `PromozioneResult`, `BatchResult`. Contiene anche costanti: `BONUS_CAR_IMPORTO_EUR = 250.00` (placeholder), `SOGLIA_MINIMA_PAYOUT_EUR = 10.00` |
| `engine.ts` | 402 | Logica pura senza I/O. Implementa i 6 step del batch: `applicaStorni`, `consolidaGvByLevel` (DFS post-order sull'albero genealogico), `checkAttivita`, `verificaPromozioni`, `calcolaProvvigioni`, `eseguiBatch` (orchestratore in-memory) |
| `repository.ts` | 221 | Query PostgreSQL tramite `pg.Pool`. Funzioni: `loadQualifiche`, `loadConsulentiMese`, `loadStorni`, `saveProvvigioni` (UPSERT idempotente), `savePromozioni`, `updateAttiviConsulenti` |
| `index.ts` | 63 | Entry point del job. `calcolaProvvigioniMensili` orchestra repository + engine in una singola transazione con COMMIT/ROLLBACK |

---

## 6. Env vars

Chiavi presenti in `web/.env.local` (SOLO NOMI, MAI VALORI):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `DATABASE_URL`

Da progress log (sessione 2026-03-30): la `DATABASE_URL` attuale ha il formato:
- `postgresql://postgres:***@db.sgqqlanflnjlkoxndssa.supabase.co:5432/postgres` — **DIRECT, causa ENOTFOUND su Vercel**

Per risolvere l'errore ENOTFOUND, sostituire con il formato Pooler (Transaction mode):
```
postgresql://postgres.sgqqlanflnjlkoxndssa:***@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

---

## 7. RLS policy attualmente in produzione

Rilevato da produzione Supabase il 2026-04-16:

| Tabella | Policy | CMD | Ruoli | USING | WITH CHECK |
|---------|--------|-----|-------|-------|------------|
| box_degustazione | box_degustazione_read | SELECT | authenticated | true | — |
| box_degustazione_righe | box_degustazione_righe_read | SELECT | authenticated | true | — |
| candidature | insert_public | INSERT | public | — | `(stato = 'in_attesa' AND note_admin IS NULL)` |
| candidature | select_authenticated | SELECT | authenticated | true | — |
| cantina_personale | cantina_personale_read | SELECT | authenticated | true | — |
| cantine_fornitrici | cantine_fornitrici_read | SELECT | authenticated | true | — |
| clienti | clienti_read | SELECT | authenticated | true | — |
| consulente_vini_preferiti | modify_own | ALL | authenticated | `consulente_id = (SELECT consulenti.id FROM consulenti WHERE consulenti.auth_user_id = auth.uid())` | — |
| consulente_vini_preferiti | select_all_authenticated | SELECT | authenticated | true | — |
| consulente_vini_preferiti | select_public | SELECT | anon | true | — |
| consulenti | consulenti_read | SELECT | authenticated | true | — |
| eventi | eventi_read | SELECT | authenticated | true | — |
| eventi_partecipanti | eventi_partecipanti_read | SELECT | authenticated | true | — |
| interazioni_crm | interazioni_crm_read | SELECT | authenticated | true | — |
| lead | lead_read | SELECT | authenticated | true | — |
| magazzino_consulente | magazzino_consulente_read | SELECT | authenticated | true | — |
| movimenti_magazzino | movimenti_magazzino_read | SELECT | authenticated | true | — |
| ordini | ordini_read | SELECT | authenticated | true | — |
| ordini_righe | ordini_righe_read | SELECT | authenticated | true | — |
| prodotti | prodotti_read | SELECT | authenticated | true | — |
| provvigioni_mensili | provvigioni_mensili_read | SELECT | authenticated | true | — |
| qualifiche | qualifiche_read | SELECT | authenticated | true | — |
| regioni | regioni_read | SELECT | authenticated | true | — |
| storni_pv | storni_pv_read | SELECT | authenticated | true | — |

**Osservazioni:**
- 24 policy totali, quasi tutte SELECT permissive (`true`) per ruolo `authenticated` — nessun filtro row-level per consulente (chiunque sia loggato vede tutti i dati)
- Unica policy INSERT attiva: `candidature.insert_public` con check `stato='in_attesa' AND note_admin IS NULL` (accesso pubblico/anon)
- Unica policy con filtro row-level reale: `consulente_vini_preferiti.modify_own`
- **Nessuna policy di scrittura (INSERT/UPDATE/DELETE) sulle tabelle operative** (`ordini`, `consulenti`, `clienti`, ecc.) — le scritture passano tutte per RPC con `SECURITY DEFINER`

---

## 8. Migrations applicate

Lista file in `db/migrations/`:

| File | Descrizione |
|------|-------------|
| `001_security_fixes.sql` | Fix Supabase Security Advisor (2026-03-29 + aggiornamento 2026-03-31): SET search_path sulle funzioni SECURITY DEFINER (`get_team_consulente`, `get_dashboard_consulente`, `crea_ordine_consulente`); pg_trgm spostata in schema `extensions`; policy RLS `insert_public` su `candidature` ristretta a `stato = 'in_attesa' AND note_admin IS NULL` |

---

## 9. Contratto e tesserino esistenti

- Contratto incaricato: NON PRESENTE NEL REPO
- Tesserino di riconoscimento (L.173/2005): NON PRESENTE NEL REPO

---

## 10. Dipendenze principali web/package.json

Versioni:
- next: `16.2.1`
- @supabase/supabase-js: `^2.100.1`
- @supabase/ssr: `^0.9.0`
- pg: `^8.20.0`
- stripe: NON PRESENTE (non ancora integrato)
- tailwindcss: `^4.2.2` (devDependency)

Scripts:
- `dev`: `next dev`
- `build`: `next build`
- `start`: `next start`
- `lint`: `eslint`

---

## 11. Note libere — discrepanze trovate

Discrepanze docs vs codice reale:

1. **`auth_user_id` e `ruolo` assenti da schema.sql** — Le colonne sono usate ovunque nel codice (`proxy.ts`, `dashboard/page.tsx`, `route.ts`) ma non compaiono in `db/schema.sql`. Sono state probabilmente aggiunte via Supabase dashboard senza aggiornare il file di schema nel repo. Impatto: lo schema nel repo non è la source of truth reale.

2. **Tabella `candidature` assente da schema.sql** — Esiste in produzione (migration 001 la modifica, la pagina admin la legge) ma il CREATE TABLE non è nel repo.

3. **`web/src/app/page.tsx` è solo un redirect** — Nessuna landing page pubblica (la home reindirizza direttamente a `/dashboard`). Coerente con la natura CRM del sistema ma in contrasto con il doc 07 che parla di pagine pubbliche.

4. **Stripe non installato** — Il piano compensi prevede pagamenti via Stripe (`stripe_account_id` in `consulenti`, `stripe_payment_id` in `ordini`) ma il pacchetto `stripe` non è in `package.json`.

5. **Bonus Car importo placeholder** — `BONUS_CAR_IMPORTO_EUR = 250.00` in `types.ts` è esplicitamente un valore placeholder in attesa di decisione con FP (da doc 12 §6).

6. **`NEXT_PUBLIC_SITE_URL` vuota su Vercel** — Segnalata in 3 sessioni consecutive (2026-03-30, 2026-03-31, 2026-04-16) come punto aperto. Necessaria per i redirect Supabase Auth.

TODO/FIXME nel codice (da `grep`):
- `web/src/lib/provvigioni/types.ts:43` — `// Importo Bonus Car mensile (DA DECIDERE — doc 12 §6). Placeholder fino a decisione con FP.`
- `web/src/lib/provvigioni/engine.ts:148` — `// Provvigione personale: [DA DECIDERE] — qui implementata anche se inattivo`
- `web/src/lib/provvigioni/engine.ts:321` — `// Solo AMBASSADOR+ attivi (doc 02). Importo DA DECIDERE con FP.`

---

## 12. Stato di avanzamento per area

- Autenticazione base Supabase: ✅ (login funzionante, proxy con guard ruolo, cookie `invinus_ruolo`)
- Catalogo prodotti (CRUD + visualizzazione): ✅ (30 prodotti seed, pagina `/catalogo` con client component)
- Dashboard consulente PV/GV: ✅ (4 card PV/GV/status/guadagni, RPC `get_dashboard_consulente`, referral link)
- Albero team: ✅ (pagina `/team` con `TeamClient.tsx`)
- Creazione ordine con PV: ✅ (pagina `/ordini` con `OrdiniClient.tsx` + `actions.ts`, RPC `crea_ordine_consulente`)
- Pannello admin (4 pagine): ✅ (candidature, consulenti, dashboard, provvigioni — tutte presenti)
- Calcolo provvigioni batch: 🟡 (engine completo e testabile, bloccato da ENOTFOUND su Vercel — causa DATABASE_URL direct invece di pooler)
- Pagina /ref/\<slug\>: ✅ (`web/src/app/ref/[code]/page.tsx` + `CandidaturaForm.tsx` esistono)
- Registrazione cliente: 🟡 (gestione clienti presente in area consulente, flusso registrazione pubblica non autonomo)
- Registrazione incaricato con KYC: 🟡 (form candidatura su `/ref/[code]` presente, flusso approvazione admin presente, KYC documentale non implementato)
- Wallet incaricato: ❌ (nessuna pagina wallet — Stripe non integrato)
- Area documenti aziendali: ❌ (nessuna pagina documenti)
- Editor piano compensi admin: ❌ (la tabella `qualifiche` esiste ma nessuna UI di editing — solo visualizzazione)
- Configurazione catalogo completa: 🟡 (seed dati presenti, UI admin gestione catalogo non trovata nel repo)
- Tesserino L.173/2005: ❌ (nessun template o generatore nel repo)
