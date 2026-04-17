-- =============================================================================
-- M1 — Query di verifica stato produzione Supabase
-- Eseguire in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- Eseguire ogni blocco separatamente e incollare i risultati a Claude Code.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Lista completa delle tabelle nello schema public
-- ---------------------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- ---------------------------------------------------------------------------
-- 2. Colonne della tabella consulenti (incluse auth_user_id e ruolo)
-- ---------------------------------------------------------------------------
SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'consulenti'
ORDER BY ordinal_position;

-- ---------------------------------------------------------------------------
-- 3. Colonne della tabella candidature
-- ---------------------------------------------------------------------------
SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'candidature'
ORDER BY ordinal_position;

-- ---------------------------------------------------------------------------
-- 4. Colonne della tabella clienti
-- ---------------------------------------------------------------------------
SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clienti'
ORDER BY ordinal_position;

-- ---------------------------------------------------------------------------
-- 5. Colonne della tabella consulente_vini_preferiti
--    (presente in prod per le RLS policy — non in schema.sql)
-- ---------------------------------------------------------------------------
SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'consulente_vini_preferiti'
ORDER BY ordinal_position;

-- ---------------------------------------------------------------------------
-- 6. Enum esistenti nello schema public (tutti i valori)
-- ---------------------------------------------------------------------------
SELECT
  t.typname      AS enum_name,
  e.enumlabel    AS enum_value
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typnamespace = (
  SELECT oid FROM pg_namespace WHERE nspname = 'public'
)
ORDER BY t.typname, e.enumsortorder;

-- ---------------------------------------------------------------------------
-- 7. Funzioni custom nello schema public
-- ---------------------------------------------------------------------------
SELECT
  proname                                          AS function_name,
  pg_get_function_identity_arguments(oid)          AS arguments
FROM pg_proc
WHERE pronamespace = (
  SELECT oid FROM pg_namespace WHERE nspname = 'public'
)
  AND prokind = 'f'
ORDER BY proname;
