-- =============================================================================
-- Migration 004 — RLS policy granulari + column-level privileges + storage fix
-- =============================================================================
-- NON IDEMPOTENTE (come 003).
-- Motivo: DROP POLICY IF EXISTS + CREATE POLICY non è idempotente se eseguita
-- due volte — la seconda esecuzione DROP+CREATE funziona, ma i GRANT colonna
-- sono cumulativi in PostgreSQL: un doppio GRANT non causa errore ma indica
-- esecuzione multipla inattesa. Non aggiungere IF NOT EXISTS su GRANT/REVOKE.
-- Eseguire UNA SOLA VOLTA su un DB pulito (policy precedenti droppate nel §4).
--
-- Esecuzione: tutto in una singola transazione BEGIN/COMMIT.
-- In caso di errore a metà: rollback automatico, DB resta consistente.
-- A differenza di 003, non ci sono ALTER TYPE RENAME VALUE problematici,
-- quindi una sola transazione è sufficiente.
-- =============================================================================

BEGIN;

-- =============================================================================
-- §1 — Schema change: candidatura_id su incaricati
-- =============================================================================

ALTER TABLE incaricati ADD COLUMN candidatura_id INT REFERENCES candidature(id);
CREATE INDEX idx_incaricati_candidatura ON incaricati(candidatura_id);


-- =============================================================================
-- §2 — Funzioni helper
-- =============================================================================

-- Restituisce incaricati.id dell'utente corrente. NULL se non mappato.
CREATE OR REPLACE FUNCTION current_incaricato_id()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM incaricati WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- True se l'utente corrente ha ruolo 'admin'.
CREATE OR REPLACE FUNCTION current_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM incaricati
    WHERE auth_user_id = auth.uid() AND ruolo = 'admin'
  )
$$;

-- Restituisce il profilo completo (tutti i campi) del proprio incaricato.
-- Usata dalle pagine profilo personale per accedere ai campi revocati (email, ecc.).
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS SETOF incaricati
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM incaricati WHERE auth_user_id = auth.uid() LIMIT 1
$$;


-- Restituisce il profilo completo di un singolo incaricato (solo admin).
-- Bypassa il column-level REVOKE per l'area admin /admin/incaricati/[id].
CREATE OR REPLACE FUNCTION admin_get_incaricato_full(p_incaricato_id INT)
RETURNS SETOF incaricati
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM incaricati WHERE id = p_incaricato_id AND current_is_admin()
$$;

-- Restituisce tutti gli incaricati con campi completi (solo admin).
-- Bypassa il column-level REVOKE per l'area admin /admin/incaricati.
CREATE OR REPLACE FUNCTION admin_get_all_incaricati_full()
RETURNS SETOF incaricati
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM incaricati WHERE current_is_admin()
$$;


-- =============================================================================
-- §3 — Column-level privileges su incaricati
-- =============================================================================
-- Colonne revocate (sensibili — accessibili solo via get_my_profile() o admin RPC):
--   email, telefono, codice_fiscale, stripe_account_id,
--   data_ultimo_status_change, approvato_da, approvato_il
--
-- Tutte e 27 le colonne attuali sono classificate (verificato via information_schema).
-- candidatura_id (aggiunta in §1) inclusa nel GRANT.

REVOKE SELECT ON TABLE incaricati FROM authenticated;

GRANT SELECT (
  id,
  nome,
  cognome,
  sponsor_id,
  status,
  status_max,
  ruolo,
  pv_mese_corrente,
  gv_mese_corrente,
  attivo,
  formazione_completata,
  link_referral,
  stato_account,
  data_iscrizione,
  created_at,
  auth_user_id,
  foto_url,
  bio,
  messaggio_referral,
  specialita,
  candidatura_id
) ON TABLE incaricati TO authenticated;


-- =============================================================================
-- §4 — Policy per tabella
-- =============================================================================

-- ----------------------------------------------------------------------------
-- §4.A — DATI PERSONALI INCARICATO
-- ----------------------------------------------------------------------------

-- incaricati
DROP POLICY IF EXISTS "incaricati_read" ON incaricati;

CREATE POLICY "inc_select_all" ON incaricati
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "inc_update_own" ON incaricati
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "admin_all" ON incaricati
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- incaricato_vini_preferiti
DROP POLICY IF EXISTS "select_all_authenticated" ON incaricato_vini_preferiti;
-- MANTIENE: "select_public" (anon SELECT — serve /ref/[code])
-- MANTIENE: "modify_own"    (ALL authenticated propri — già corretto)

CREATE POLICY "admin_all" ON incaricato_vini_preferiti
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- provvigioni_mensili
DROP POLICY IF EXISTS "provvigioni_mensili_read" ON provvigioni_mensili;

CREATE POLICY "inc_select_own" ON provvigioni_mensili
  FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

CREATE POLICY "admin_all" ON provvigioni_mensili
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- magazzino_consulente
DROP POLICY IF EXISTS "magazzino_consulente_read" ON magazzino_consulente;

CREATE POLICY "inc_select_own" ON magazzino_consulente
  FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

CREATE POLICY "admin_all" ON magazzino_consulente
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- movimenti_magazzino
DROP POLICY IF EXISTS "movimenti_magazzino_read" ON movimenti_magazzino;

CREATE POLICY "inc_select_own" ON movimenti_magazzino
  FOR SELECT TO authenticated
  USING (
    magazzino_id IN (
      SELECT id FROM magazzino_consulente
      WHERE incaricato_id = current_incaricato_id()
    )
  );

CREATE POLICY "admin_all" ON movimenti_magazzino
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- cantina_personale
-- CHECK cantina_personale_utente_tipo_check già esistente da migration 003
-- (valori: 'INCARICATO', 'CLIENTE') — nessun ALTER TABLE necessario
DROP POLICY IF EXISTS "cantina_personale_read" ON cantina_personale;

CREATE POLICY "inc_own" ON cantina_personale
  FOR ALL TO authenticated
  USING (utente_tipo = 'INCARICATO' AND utente_id = current_incaricato_id())
  WITH CHECK (utente_tipo = 'INCARICATO' AND utente_id = current_incaricato_id());

CREATE POLICY "admin_all" ON cantina_personale
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- ----------------------------------------------------------------------------
-- §4.B — DATI TRANSAZIONALI
-- ----------------------------------------------------------------------------

-- clienti
DROP POLICY IF EXISTS "clienti_read" ON clienti;

CREATE POLICY "inc_select_own" ON clienti
  FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_insert_own" ON clienti
  FOR INSERT TO authenticated
  WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_update_own" ON clienti
  FOR UPDATE TO authenticated
  USING (incaricato_id = current_incaricato_id())
  WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY "admin_all" ON clienti
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- ordini
DROP POLICY IF EXISTS "ordini_read" ON ordini;

CREATE POLICY "inc_select_own" ON ordini
  FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_insert_own" ON ordini
  FOR INSERT TO authenticated
  WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY "admin_all" ON ordini
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- ordini_righe
DROP POLICY IF EXISTS "ordini_righe_read" ON ordini_righe;

CREATE POLICY "inc_select_own" ON ordini_righe
  FOR SELECT TO authenticated
  USING (
    ordine_id IN (
      SELECT id FROM ordini WHERE incaricato_id = current_incaricato_id()
    )
  );

CREATE POLICY "inc_insert_own" ON ordini_righe
  FOR INSERT TO authenticated
  WITH CHECK (
    ordine_id IN (
      SELECT id FROM ordini WHERE incaricato_id = current_incaricato_id()
    )
  );

CREATE POLICY "admin_all" ON ordini_righe
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- lead
DROP POLICY IF EXISTS "lead_read" ON lead;

CREATE POLICY "inc_select_own" ON lead
  FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_insert_own" ON lead
  FOR INSERT TO authenticated
  WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_update_own" ON lead
  FOR UPDATE TO authenticated
  USING (incaricato_id = current_incaricato_id())
  WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY "admin_all" ON lead
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- interazioni_crm
DROP POLICY IF EXISTS "interazioni_crm_read" ON interazioni_crm;

CREATE POLICY "inc_select_own" ON interazioni_crm
  FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_insert_own" ON interazioni_crm
  FOR INSERT TO authenticated
  WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_update_own" ON interazioni_crm
  FOR UPDATE TO authenticated
  USING (incaricato_id = current_incaricato_id())
  WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY "admin_all" ON interazioni_crm
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- eventi
DROP POLICY IF EXISTS "eventi_read" ON eventi;

CREATE POLICY "inc_select_own" ON eventi
  FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_insert_own" ON eventi
  FOR INSERT TO authenticated
  WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_update_own" ON eventi
  FOR UPDATE TO authenticated
  USING (incaricato_id = current_incaricato_id())
  WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY "admin_all" ON eventi
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- eventi_partecipanti
DROP POLICY IF EXISTS "eventi_partecipanti_read" ON eventi_partecipanti;

CREATE POLICY "inc_select_own" ON eventi_partecipanti
  FOR SELECT TO authenticated
  USING (
    evento_id IN (
      SELECT id FROM eventi WHERE incaricato_id = current_incaricato_id()
    )
  );

CREATE POLICY "inc_insert_own" ON eventi_partecipanti
  FOR INSERT TO authenticated
  WITH CHECK (
    evento_id IN (
      SELECT id FROM eventi WHERE incaricato_id = current_incaricato_id()
    )
  );

CREATE POLICY "admin_all" ON eventi_partecipanti
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- storni_pv
DROP POLICY IF EXISTS "storni_pv_read" ON storni_pv;

CREATE POLICY "inc_select_own" ON storni_pv
  FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

CREATE POLICY "admin_all" ON storni_pv
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- ----------------------------------------------------------------------------
-- §4.C — REFERENCE TABLES (lettura pubblica)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "prodotti_read" ON prodotti;
CREATE POLICY "public_read" ON prodotti
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_all" ON prodotti
  FOR ALL TO authenticated
  USING (current_is_admin()) WITH CHECK (current_is_admin());

DROP POLICY IF EXISTS "regioni_read" ON regioni;
CREATE POLICY "public_read" ON regioni
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_all" ON regioni
  FOR ALL TO authenticated
  USING (current_is_admin()) WITH CHECK (current_is_admin());

DROP POLICY IF EXISTS "qualifiche_read" ON qualifiche;
CREATE POLICY "public_read" ON qualifiche
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_all" ON qualifiche
  FOR ALL TO authenticated
  USING (current_is_admin()) WITH CHECK (current_is_admin());

DROP POLICY IF EXISTS "cantine_fornitrici_read" ON cantine_fornitrici;
CREATE POLICY "public_read" ON cantine_fornitrici
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_all" ON cantine_fornitrici
  FOR ALL TO authenticated
  USING (current_is_admin()) WITH CHECK (current_is_admin());

DROP POLICY IF EXISTS "box_degustazione_read" ON box_degustazione;
CREATE POLICY "public_read" ON box_degustazione
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_all" ON box_degustazione
  FOR ALL TO authenticated
  USING (current_is_admin()) WITH CHECK (current_is_admin());

DROP POLICY IF EXISTS "box_degustazione_righe_read" ON box_degustazione_righe;
CREATE POLICY "public_read" ON box_degustazione_righe
  FOR SELECT TO anon, authenticated
  USING (box_id IN (SELECT id FROM box_degustazione));
CREATE POLICY "admin_all" ON box_degustazione_righe
  FOR ALL TO authenticated
  USING (current_is_admin()) WITH CHECK (current_is_admin());

-- ----------------------------------------------------------------------------
-- §4.D — ADMIN-ONLY
-- ----------------------------------------------------------------------------

-- candidature
-- MANTIENE: "insert_public" (anon INSERT con with_check — già corretto)
DROP POLICY IF EXISTS "select_authenticated" ON candidature;

CREATE POLICY "inc_select_own_candidatura" ON candidature
  FOR SELECT TO authenticated
  USING (
    id = (SELECT candidatura_id FROM incaricati WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "admin_all" ON candidature
  FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());

-- ----------------------------------------------------------------------------
-- §5 — Storage: fix bucket profili (blocca listing, mantiene accesso per URL diretto)
-- ----------------------------------------------------------------------------
-- Sanity check pre-migration: "public_read" esiste SOLO su storage.objects
-- per bucket_id='profili' (verificato via pg_policies 2026-04-18).

DROP POLICY IF EXISTS "public_read" ON storage.objects;

CREATE POLICY "profili_public_read_no_listing" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'profili'
    AND storage.filename(name) != ''
  );

COMMIT;
