-- =============================================================================
-- Migrazione 001 — Security fixes (Security Advisor Supabase)
-- Data: 2026-03-29
-- =============================================================================

-- Fix: function_search_path_mutable
-- Tutte le funzioni SECURITY DEFINER devono avere search_path fisso
-- per prevenire attacchi di tipo search_path injection.

ALTER FUNCTION public.get_team_consulente(integer, integer, integer)
  SET search_path = public;

ALTER FUNCTION public.get_dashboard_consulente(integer, integer, integer)
  SET search_path = public;

ALTER FUNCTION public.crea_ordine_consulente(integer, text, jsonb)
  SET search_path = public;

-- Fix: extension_in_public
-- pg_trgm spostata in schema dedicato 'extensions' (standard Supabase).
-- L'indice idx_prodotti_nome_trgm resta funzionante (legato a OID).

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Nota: Leaked password protection (HaveIBeenPwned) va abilitata
-- dalla dashboard Supabase: Authentication > Settings > Password Security.
