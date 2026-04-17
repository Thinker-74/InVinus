-- =============================================================================
-- M1.5 — Queries preparatorie da eseguire in Supabase SQL Editor
-- Prima di applicare la migration 003, recupera i dati necessari.
--
-- ISTRUZIONI: esegui ognuno dei blocchi separatamente nel SQL Editor di Supabase.
-- Copia l'output e incollalo nella chat con Claude Code.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- QUERY 1 — Body di tutte le funzioni RPC da rinominare / aggiornare
-- ---------------------------------------------------------------------------
-- Recupera il corpo SQL di ciascuna delle 15 funzioni presenti in produzione.
-- Il body è necessario per scrivere le CREATE FUNCTION nuove nella migration 003.

SELECT
  proname                     AS nome_funzione,
  pg_get_functiondef(oid)     AS body
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'aggiorna_profilo_consulente',
    'aggiungi_cliente_consulente',
    'candida_consulente',
    'crea_ordine_consulente',
    'get_admin_consulenti',
    'get_admin_kpi',
    'get_admin_top_consulenti',
    'get_admin_trend',
    'get_clienti_consulente',
    'get_consulente_by_referral',
    'get_dashboard_consulente',
    'get_team_consulente',
    'rls_auto_enable',
    'set_referral_code',
    'set_vini_preferiti'
  )
ORDER BY proname;


-- ---------------------------------------------------------------------------
-- QUERY 2 — Tabelle che contengono una colonna di nome 'consulente_id'
-- ---------------------------------------------------------------------------
-- Verifica la lista completa — potrebbe esserci qualcosa non in schema.sql.

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'consulente_id'
ORDER BY table_name;


-- ---------------------------------------------------------------------------
-- QUERY 3 — Colonne che contengono "consulente" nel nome (escluso consulente_id)
-- ---------------------------------------------------------------------------
-- Cattura colonne come 'convertito_consulente_id' in tabella lead
-- che potrebbero non essere in schema.sql.

SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name LIKE '%consulente%'
  AND column_name <> 'consulente_id'
ORDER BY table_name, column_name;


-- ---------------------------------------------------------------------------
-- QUERY 4 — FK che referenziano la tabella 'consulenti'
-- ---------------------------------------------------------------------------
-- Verifica che non ci siano FK da tabelle non previste.

SELECT
  tc.table_name                       AS tabella_sorgente,
  kcu.column_name                     AS colonna_sorgente,
  tc.constraint_name,
  ccu.table_name                      AS tabella_target,
  ccu.column_name                     AS colonna_target
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema   = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema   = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema    = 'public'
  AND ccu.table_name     = 'consulenti'
ORDER BY tc.table_name;


-- ---------------------------------------------------------------------------
-- QUERY 5 — Enum types con "consulente" nel nome + loro valori
-- ---------------------------------------------------------------------------
-- Verifica i 3 enum da rinominare e i loro valori attuali.

SELECT
  t.typname                           AS enum_type,
  e.enumlabel                         AS valore,
  e.enumsortorder                     AS ordine
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typnamespace = 'public'::regnamespace
  AND t.typname LIKE '%consulente%'
ORDER BY t.typname, e.enumsortorder;


-- ---------------------------------------------------------------------------
-- QUERY 6 — Tabelle con "consulente" nel nome
-- ---------------------------------------------------------------------------
-- Verifica che le uniche tabelle da rinominare siano 'consulenti'
-- e 'consulente_vini_preferiti'.

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%consulente%'
ORDER BY table_name;


-- ---------------------------------------------------------------------------
-- QUERY 7 — RLS policy attive sulle tabelle da rinominare
-- ---------------------------------------------------------------------------
-- Recupera il corpo delle policy per poterle ricreare nella migration 003.

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual      AS using_expr,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('consulenti', 'consulente_vini_preferiti')
ORDER BY tablename, policyname;


-- ---------------------------------------------------------------------------
-- QUERY 8 — Indici sulle tabelle da rinominare
-- ---------------------------------------------------------------------------
-- Verifica tutti gli indici presenti (inclusi quelli creati automaticamente
-- da Postgres come pkey/unique).

SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('consulenti', 'consulente_vini_preferiti')
ORDER BY tablename, indexname;


-- ---------------------------------------------------------------------------
-- QUERY 9 — Valore 'consulente' nell'enum stato_funnel_lead
-- ---------------------------------------------------------------------------
-- DECISIONE APERTA: il valore 'consulente' in stato_funnel_lead
-- indica che il lead è diventato un incaricato. Va rinominato in
-- 'incaricato' oppure lasciato invariato?
-- (I dati nella tabella lead con questo stato verranno migrati se si sceglie rename.)

SELECT
  t.typname                           AS enum_type,
  e.enumlabel                         AS valore,
  e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typnamespace = 'public'::regnamespace
  AND t.typname = 'stato_funnel_lead'
ORDER BY e.enumsortorder;

-- Conta quanti lead hanno stato = 'consulente' (per capire impatto rename)
SELECT COUNT(*) AS lead_con_stato_consulente
FROM lead
WHERE stato_funnel = 'consulente';


-- ---------------------------------------------------------------------------
-- QUERY 10 — Sequenze legate alle tabelle da rinominare
-- ---------------------------------------------------------------------------
-- Verifica che le sequenze siano le attese (postgres le rinomina
-- automaticamente con ALTER TABLE RENAME ma è bene saperlo).

SELECT sequencename, last_value
FROM pg_sequences
WHERE schemaname = 'public'
  AND (sequencename LIKE '%consulenti%' OR sequencename LIKE '%consulente%');
