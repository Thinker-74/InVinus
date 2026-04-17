# Checkpoint — 2026-04-17 — M0 fix pooler provvigioni ✅

**Progetto:** InVinus
**Milestone:** M0 — Fix ENOTFOUND calcolo provvigioni su Vercel

## Cosa è stato fatto
- Reset password DB Supabase (password pulita, solo alfanumerica)
- Cambiata `DATABASE_URL` da Direct connection a Transaction Pooler:
  - Da: `postgresql://postgres:***@db.sgqqlanflnjlkoxndssa.supabase.co:5432/postgres`
  - A:  `postgresql://postgres.sgqqlanflnjlkoxndssa:***@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
- Aggiornata env var su Vercel (tutti gli environment)
- Aggiornato `web/.env.local`
- Redeploy production

## Verifica
- `/admin/provvigioni` → "Calcola provvigioni" → risposta OK
- Batch test su mese con seed data: 4 consulenti attivi, 1 inattivo, totale € 203.92

## Note tecniche
- Causa radice: hostname `db.<ref>.supabase.co` risolve solo su IPv6, Vercel serverless è IPv4-only → `ENOTFOUND`
- Pooler Supavisor su `aws-1-eu-north-1.pooler.supabase.com` supporta IPv4
- Username per pooler richiede suffisso `.<project_ref>` (es. `postgres.sgqqlanflnjlkoxndssa`)
- `?pgbouncer=true` obbligatorio (disabilita prepared statements, non supportate da Supavisor in transaction mode)
- Attenzione caratteri speciali nella password (es. `!`): vanno URL-encoded (`%21`). Consigliato: password solo alfanumerica per evitare encoding issues

## Warning non bloccanti osservati
- Next.js build: `Both outputFileTracingRoot and turbopack.root are set, but they must have the same value` — da sistemare in M1

## Prossimi passi
- M1 — Allineamento `db/schema.sql` con produzione reale (auth_user_id, ruolo, candidature mancanti dal file di schema nel repo)
- Fix warning Next.js `outputFileTracingRoot` vs `turbopack.root` (piggyback su M1)

## Blocchi / Note
- Nessuno
