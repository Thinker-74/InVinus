# Checkpoint — 2026-04-18 — M2 RLS policy granulari ✅

**Progetto:** InVinus
**Milestone:** M2 — RLS policy granulari per incaricato/admin su auth_user_id

## Cosa è stato fatto

### Migration 004 — db/migrations/004_rls_granulari.sql

**Schema change:**
- `ALTER TABLE incaricati ADD COLUMN candidatura_id INT REFERENCES candidature(id)` + index
- Consente a un incaricato di vedere la propria candidatura storica

**Funzioni helper (5 — STABLE, SECURITY DEFINER):**
- `current_incaricato_id()`: risolve auth.uid() → incaricati.id (ponte RLS)
- `current_is_admin()`: verifica ruolo='admin' per l'utente corrente
- `get_my_profile()`: profilo completo del proprio incaricato (bypass column-level per area personale)
- `admin_get_incaricato_full(p_incaricato_id)`: dettaglio singolo con colonne sensibili (solo admin)
- `admin_get_all_incaricati_full()`: lista completa con colonne sensibili (solo admin)

**Column-level privileges su `incaricati`:**
- REVOKE SELECT (7 colonne): `email`, `telefono`, `codice_fiscale`, `stripe_account_id`, `data_ultimo_status_change`, `approvato_da`, `approvato_il`
- GRANT SELECT (22 colonne): tutte le restanti sicure
- 27 colonne totali verificate via information_schema — nessuna non classificata

**Policy per tabella (22 DROP + 56 CREATE):**
- Pattern: `inc_*` (predicato su incaricato_id) + `admin_all` (current_is_admin() FOR ALL)
- Tabelle dati personali: incaricati, incaricato_vini_preferiti, provvigioni_mensili, magazzino_consulente, movimenti_magazzino, cantina_personale
- Tabelle transazionali: clienti, ordini, ordini_righe, lead, interazioni_crm, eventi, eventi_partecipanti, storni_pv
- Reference tables: prodotti, regioni, qualifiche, cantine_fornitrici, box_degustazione, box_degustazione_righe — `public_read` per anon+authenticated
- Admin-only: candidature — INSERT anon mantenuto, aggiunta `inc_select_own_candidatura`
- `incaricato_vini_preferiti`: mantenute `select_public` (anon per /ref/[code]) e `modify_own` esistenti

**Storage fix:**
- DROP `public_read` + CREATE `profili_public_read_no_listing` con `storage.filename(name) != ''`
- Blocca listing API, mantiene accesso per URL diretto

### Codice TypeScript
- `web/src/app/admin/incaricati/[id]/page.tsx`: migrata da `.from("incaricati").select(...)` a `.rpc("admin_get_incaricato_full", { p_incaricato_id })` — risolve errore column-level REVOKE
- `web/src/types/supabase.ts`: rigenerati con 5 nuove RPC (admin_get_*, current_*, get_my_profile)

## Verifiche eseguite

### DDL (5 verifiche MCP post-migration)
1. Conteggio policy: 21 tabelle, tutti i conteggi attesi ✅
2. Funzioni helper: 5/5 presenti, prosecdef=true, provolatile='s' ✅
3. Column privileges: 22 colonne SELECT per authenticated, le 7 sensibili assenti ✅
4. candidatura_id: presente come integer ✅
5. Storage: `profili_public_read_no_listing` attivo, `public_read` rimossa ✅

### Funzionale (simulazione Francesco via SET LOCAL ROLE authenticated)
- `COUNT(*) FROM incaricati` → 5 (admin_all funziona) ✅
- `COUNT(*) FROM clienti` → 4 ✅
- `COUNT(*) FROM ordini` → 11 ✅
- `COUNT(*) FROM provvigioni_mensili` → 5 ✅
- `SELECT email FROM incaricati WHERE id=2` → ERROR permission denied (column-level attivo) ✅

### Produzione (smoke test post-deploy Vercel)
- `/admin/incaricati` lista carica con email via RPC ✅
- `/admin/incaricati/[id]` dettaglio carica con email/telefono via RPC ✅
- `/admin/provvigioni` calcolo €203.92 invariato ✅
- `/ref/FrancescoP` landing carica ✅

## File modificati
- `db/migrations/004_rls_granulari.sql` — creato (migration completa)
- `web/src/app/admin/incaricati/[id]/page.tsx` — migrata a admin_get_incaricato_full RPC
- `web/src/types/supabase.ts` — rigenerati (5 nuove RPC)
- `docs/STATO.md` — M2 ✅, sezione RLS aggiornata, note operative + gen types
- `docs/m2-piano.md` — creato (piano di progettazione M2)

## Scope esclusi (intenzionali)

- **M2.5** (deroghe qualifica): regole per incaricati con deroga admin — non implementate, richiede colonna `deroga_qualifica` e logica separata
- **M2.7** (eventi upline/downline): serate aziendali visibili a tutti gli incaricati — posticipato; colonna `tipo_evento` già esistente (enum `tipo_evento` con default `serata_degustazione`), M2.7 sarà solo `CREATE POLICY` aggiuntiva
- **Privilegi stellati** (admin vede tutto via SELECT diretto): column-level REVOKE si applica al ruolo DB `authenticated` — l'admin usa RPC SECURITY DEFINER per colonne sensibili, non bypass a livello di ruolo DB
- `cantina_personale` con `utente_tipo='CLIENTE'`: nessuna policy per clienti — gestito in M6 con auth cliente

## Note decisionali

**Column-level vs view:** scelto column-level REVOKE per semplicità e compatibilità PostgREST. Una view alternativa avrebbe richiesto riscrivere tutti i riferimenti. Il pattern RPC SECURITY DEFINER per bypass controllato è più flessibile e audit-friendly.

**Admin RPC pattern:** `admin_get_*_full()` con condizione `AND current_is_admin()` in body — se chiamata da non-admin ritorna vuoto (non errore). Design intenzionale: fail-silent per evitare information disclosure nel messaggio di errore.

**SELECT aperto su incaricati:** `inc_select_all` usa `USING (true)` — necessario per JOIN (dashboard mostra sponsor, albero team). I campi sensibili sono protetti a column-level, non a row-level. Scelta corretta per MVP.

## Prossime milestone

- **M2.5** (opzionale): deroghe qualifica — regole speciali admin per incaricati con stato particolare
- **M2.7** (opzionale): eventi aziendali visibili a tutti — solo CREATE POLICY (nessun ALTER TABLE)
- **M3**: Referral finalizzato (2 CTA: cliente/incaricato) — richiede `NEXT_PUBLIC_SITE_URL` su Vercel
