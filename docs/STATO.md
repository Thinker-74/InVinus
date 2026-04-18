# docs/STATO.md — Stato operativo corrente del progetto InVinus

> Living document. Aggiornato a fine milestone e a fine sessione significativa.
> Source of truth per: stato roadmap, credenziali demo, decisioni operative, note tecniche correnti.
> Per decisioni strategiche vedi docs/01-* a docs/14-* + CLAUDE.md.
> Per log cronologico milestone vedi docs/progress/.

Ultimo aggiornamento: 2026-04-18 dopo M1.10

---

## Stack (v7 — decisioni congelate, doc 13)
- **Database + Auth + API + Storage:** Supabase (free tier, PostgreSQL managed)
  - Progetto: `sgqqlanflnjlkoxndssa.supabase.co`
  - CLI installato: `~/.local/bin/supabase v2.84.2` (già loggato + linkato)
  - CRUD automatico via PostgREST — zero codice per operazioni base
  - Auth con JWT e Row Level Security
  - Edge Functions (Deno/TypeScript) per logica custom
  - pgvector per RAG della chat AI
- **Frontend (web + mobile PWA):** Next.js 16.2.1, React 19, TypeScript, Tailwind CSS v4
  - Root: `web/` dentro il monorepo InVinus
  - Una sola codebase per desktop (backoffice) e mobile (PWA installabile)
  - `npm run dev/build` richiede `--include=dev` (npm config omit=dev sul server)
- **Hosting frontend:** Vercel (free tier) — **LIVE su `https://invinus.vercel.app`**
- **Pagamenti:** Stripe (commissioni %, nessun costo fisso)
- **Chat AI:** API Claude Sonnet (~10-15€/mese anno 1)
- **Costo infrastruttura anno 1:** ~15€/mese
- **Test engine provvigioni:** Jest + ts-jest (46 test, tutti green al 2026-03-28)

---

## Struttura file (root: /home/michele/Progetti/InVinus)
```
db/schema.sql                          — schema completo + seed dati
src/jobs/calcoloProvvigioni/           — engine provvigioni TypeScript (4 file)
src/__tests__/calcoloProvvigioni.test.ts — 46 test
docs/                                  — documentazione business + stato operativo
web/                                   — Next.js app (frontend + PWA)
  src/
    app/
      (auth)/login/page.tsx            — login reale Supabase Auth
      (app)/layout.tsx                 — sidebar layout
      (app)/dashboard/page.tsx         — 4 KPI card con dati reali
      (app)/team/page.tsx + TeamClient.tsx — albero downline per livello
      (app)/ordini/page.tsx + OrdiniClient.tsx + actions.ts — lista + form ordine
      (app)/catalogo/page.tsx + CatalogoClient.tsx — filtri regione/tipo/ricerca
      (app)/clienti/ + clienti/[id]/   — lista clienti + dettaglio con storico
      (app)/provvigioni/page.tsx        — storico provvigioni mensili consulente
      (app)/referral/gestisci/          — profilo referral (foto, bio, vini)
      admin/layout.tsx                  — layout admin con banner rosso
      admin/dashboard/ consulenti/ candidature/ provvigioni/ — 4 pagine admin
      api/admin/calcola-provvigioni/route.ts — Route Handler batch provvigioni
      ref/[code]/                       — landing pubblica referral (no auth)
    lib/supabase/client.ts + server.ts
    lib/provvigioni/                   — engine TS copiato da src/jobs/ (per import)
    components/Sidebar.tsx             — sidebar con sezione admin condizionale
    proxy.ts                           — protezione route, cookie referral/ruolo (Next.js 16: rinominato da middleware.ts)
    types/supabase.ts                  — tipi generati da schema live
  .env.local                           — SUPABASE_URL + ANON_KEY (non committato)
  .npmrc                               — include=dev (devDep install anche in prod)
supabase/                              — config CLI (progetto linkato)
.mcp.json                              — Supabase MCP (transport http, project_ref scoped)
```

---

## Schema DB — tabelle principali (21 tabelle su Supabase)
- `regioni`, `cantine_fornitrici`, `prodotti` (30 vini da 4 regioni)
- `qualifiche` (9 status con tutte le % residuale per livello)
- `incaricati` (albero self-join su sponsor_id; colonne extra: `auth_user_id UUID`, `ruolo ruolo_utente`, `foto_url`, `bio`, `messaggio_referral`, `specialita`)
- `candidature` (form /ref/[code]; enum `stato_candidatura`: in_attesa/approvata/rifiutata)
- `incaricato_vini_preferiti` (PK composita incaricato_id+prodotto_id, campo `ordine`)
- `clienti`, `lead`, `ordini`, `ordini_righe`
- `storni_pv`, `provvigioni_mensili` (con JSONB residuale_dettaglio)
- `eventi`, `eventi_partecipanti`, `interazioni_crm`
- `cantina_personale`, `magazzino_consulente`, `movimenti_magazzino`
- `box_degustazione`, `box_degustazione_righe`
- **`db/schema.sql` è source of truth** — workflow: migration → applica prod → aggiorna schema → commit
- **NOTA:** `magazzino_consulente` (tabella) e `prezzo_consulente` (colonna prodotti) conservano il nome originale — eccezioni intenzionali confermate

---

## Servizio provvigioni — decisioni chiave
- Ordine batch (doc 12 §9): storni → GV → attività → promozioni → bonus → payout
- Attività mensile: solo PV >= pvMin (NON GV — fonte: doc 12 §3)
- Provvigione personale (15%): pagata anche se inattivo (doc 12 §8 #4)
- Promozione: sequenziale (+1 livello), intermezzo formativo richiesto per MANAGER
- Bonus Car: placeholder 250€/mese (DA DECIDERE con Francesco Panzella)
- Soglia minima payout: 10€ (doc 12 §8 #8)
- 1 PV ≈ 1€ nei test (conversione €→PV da formalizzare)
- `eseguiBatch()` è pura (testabile), `index.ts` aggiunge persistenza DB

---

## Seed dati demo
```
Francesco (1) DIRECTOR — pv=102, sponsor=null (top of tree)
├── Giulia (2) SUPERVISOR — pv=68
│   └── Luca (3) ADVISOR — pv=55
│       └── Marta (4) APPRENTICE — pv=52
└── Roberto (5) STARTER — pv=18
```

---

## Auth e utenti demo
- Utente test: `test@invinus.it` / `InVinus2026!` (creato via Admin API)
- Collegato a Francesco Panzella (incaricati.id=1) via `auth_user_id` UUID
- `incaricati.ruolo` — enum `ruolo_utente` ('incaricato'/'admin'), Francesco ha 'admin'

---

## RLS (stato attuale — pre-M2)
- SELECT permissiva per `authenticated` su tutte le 21 tabelle
- INSERT/UPDATE/DELETE: nessuna policy (bloccato per utenti normali)
- `get_dashboard_incaricato`: SECURITY DEFINER (bypassa RLS per leggere ordini/downline)
- 8 funzioni RPC rinominate in M1.5; 3 funzioni body-only aggiornate (get_admin_kpi, set_referral_code, set_vini_preferiti)

---

## Attenzione: Supabase free tier
- Il progetto si **mette in pausa dopo ~7 giorni di inattività** (DNS rimosso)
- Sintomo: "Failed to fetch" al login, `ping sgqqlanflnjlkoxndssa.supabase.co` fallisce
- Fix: supabase.com/dashboard → progetto → **Restore** (attesa 1-2 min)

---

## Note operative
- `npm run build/dev` nel web/: usare `npm ci --include=dev` dopo clean install (npm config omit=dev)
- Dev server: `PORT=3001 npm run dev` dalla cartella `web/` (PORT=4000 occupata da altro servizio)
- **Build prod**: `npm run build` — NON usare NODE_ENV=development durante la build (causa crash React context in prerender su Next.js 16)
- `allowedDevOrigins: ['192.168.1.63']` in next.config.ts per accesso da rete locale
- `supabase db query --linked "SQL"` per query dirette al DB
- `supabase gen types typescript --linked 2>&1 | tail -n +2 > web/src/types/supabase.ts` (tail rimuove la riga "Initialising...")
- Fix applicato al seed: CF Marta Esposito SPSMRTA→SPSMRT (era 17 char, limite VARCHAR(16))
- **Next.js 16:** `middleware.ts` rinominato `proxy.ts`, funzione da `middleware()` a `proxy()` — già migrato
- Deploy Vercel: Root Directory = `web/`, env var `NEXT_PUBLIC_SUPABASE_URL` (con `https://`), `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`
- **DATABASE_URL formato corretto (Pooler):** `postgresql://postgres.sgqqlanflnjlkoxndssa:***@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
  - Username richiede suffisso `.<project_ref>`; `?pgbouncer=true` obbligatorio (disabilita prepared statements)
  - Direct connection (`db.<ref>.supabase.co:5432`) non raggiungibile da Vercel serverless (IPv6 only)
  - Password: usare solo caratteri alfanumerici per evitare URL-encoding issues (es. `!` → `%21`)
- Warning Next.js build `outputFileTracingRoot vs turbopack.root`: **RISOLTO** — rimosso `turbopack.root` da next.config.ts (era ridondante)
- **Terminologia**: figura venditoriale = "incaricato alle vendite" (L.173/2005); tutto il codice usa "incaricato" da M1.5 in poi. `magazzino_consulente` e `prezzo_consulente` sono eccezioni intenzionali (attributi di prodotto/tabella logistica, non riferimenti alla persona).
- **Supabase MCP operativo**: `.mcp.json` in project root (transport `http`, project_ref scoped). MCP attivo — Claude Code esegue SQL in autonomia senza copia-incolla.

---

## Roadmap milestone

| Milestone | Descrizione | Stato |
|-----------|-------------|-------|
| M0 | Fix pooler provvigioni (DATABASE_URL Vercel) | ✅ |
| M1 | Allineamento schema.sql con produzione | ✅ |
| M1.5 | Rename consulente→incaricato (DB, TS, UI) | ✅ |
| M1.9 | Allineamento memory/docs (scope chiarito) | ✅ |
| M1.10 | docs/STATO.md come source of truth in-repo | ✅ |
| M2 | RLS policy granulari per incaricato/admin su auth_user_id | prossima |
| M3 | Referral finalizzato (2 CTA: cliente/incaricato) | — |
| M4 | Registrazione sdoppiata | — |
| M5 | KYC + tesserino L.173/2005 | — |
| M6 | Aree personali + wallet + documenti (inclusa cantina personale cliente) | — |
| M6.5 | PWA mobile (micro-milestone dedicata, da pianificare) | — |
| M7 | Editor piano compensi + KPI zonali | — |
| M8 | Migrazione dati go-live (import incaricati legacy) | — |

---

## Decisioni operative aperte / note future

- **Requisito onboarding incaricati legacy**: importati in stato "in_onboarding" con grace period 30gg. Operano subito, KYC auto-caricato dall'incaricato, provvigioni trattenute fino a completamento e approvazione admin. Dettagli in M4/M5/M8 della roadmap (docs/08-roadmap-sviluppo.md).
- **Bonus Car**: importo placeholder 250€/mese — DA DECIDERE definitivamente con Francesco Panzella.
- **Conversione €→PV**: 1 PV ≈ 1€ nei test — da formalizzare con FP prima di M6.
- **NEXT_PUBLIC_SITE_URL** su Vercel: ancora vuota — da configurare prima di M3 (referral).
- **Dominio custom** `crm.invinus.it`: non configurato.
