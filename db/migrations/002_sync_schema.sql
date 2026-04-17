-- =============================================================================
-- Migrazione 002 — Sincronizzazione schema.sql con stato reale di produzione
-- Data: 2026-04-17
--
-- Contesto: questa migration sincronizza db/schema.sql con le modifiche applicate
-- manualmente su Supabase durante le sessioni di sviluppo 2026-02/03, prima che
-- venisse formalizzato il workflow "migration-first" (vedi CLAUDE.md §Governance).
--
-- Idempotente: può essere rieseguita su produzione senza errori.
-- Tecnica: IF NOT EXISTS sulle DDL, blocchi DO $$ con EXCEPTION WHEN duplicate_object
-- per gli enum, blocco condizionale per la colonna ruolo.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Enum stato_candidatura
--    Aggiunto manualmente ~2026-02 per la tabella candidature.
--    Valori: in_attesa (default), approvata, rifiutata.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE stato_candidatura AS ENUM ('in_attesa', 'approvata', 'rifiutata');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- 2. Enum ruolo_consulente
--    Aggiunto manualmente ~2026-03 per il sistema di controllo accessi admin.
--    Nota: il tipo si chiama ruolo_consulente (non ruolo_utente).
--    Valori: consulente (default), admin.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE ruolo_consulente AS ENUM ('consulente', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- 3. Tabella candidature
--    Creata manualmente ~2026-02 per il form di candidatura su /ref/[code].
--    Il campo email non ha UNIQUE constraint (scelta intenzionale: un utente può
--    candidarsi più volte). L'approvazione admin crea manualmente il record in
--    consulenti — nessun trigger automatico.
--    Le RLS policy (insert_public, select_authenticated) sono gestite da
--    001_security_fixes.sql e già presenti in produzione.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidature (
  id                    SERIAL PRIMARY KEY,
  nome                  VARCHAR(100) NOT NULL,
  cognome               VARCHAR(100) NOT NULL,
  email                 VARCHAR(200) NOT NULL,
  telefono              VARCHAR(20),
  motivazione           TEXT,
  sponsor_referral_code VARCHAR(100) REFERENCES consulenti(link_referral) ON UPDATE CASCADE,
  stato                 stato_candidatura NOT NULL DEFAULT 'in_attesa',
  note_admin            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 4. Tabella consulente_vini_preferiti
--    Creata manualmente ~2026-03 per la selezione vini nella landing referral.
--    PK composita su (consulente_id, prodotto_id): un consulente ha al massimo
--    un record per vino. Campo ordine: ordinamento di visualizzazione nella landing.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consulente_vini_preferiti (
  consulente_id INT NOT NULL REFERENCES consulenti(id) ON DELETE CASCADE,
  prodotto_id   INT NOT NULL REFERENCES prodotti(id)   ON DELETE CASCADE,
  ordine        SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (consulente_id, prodotto_id)
);


-- ---------------------------------------------------------------------------
-- 5. Colonne aggiuntive su consulenti
--    Tutte aggiunte manualmente ~2026-03 durante lo sviluppo di auth e referral.
-- ---------------------------------------------------------------------------

-- auth_user_id: collega il consulente all'utente Supabase Auth (auth.users.id).
-- Usato da proxy.ts e dashboard ad ogni request per identificare il consulente loggato.
ALTER TABLE consulenti ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- Profilo pubblico per la landing personalizzata /ref/[code].
-- Aggiornabili dal consulente tramite la funzione aggiorna_profilo_consulente().
ALTER TABLE consulenti ADD COLUMN IF NOT EXISTS foto_url           VARCHAR(500);
ALTER TABLE consulenti ADD COLUMN IF NOT EXISTS bio                VARCHAR(1000);
ALTER TABLE consulenti ADD COLUMN IF NOT EXISTS messaggio_referral VARCHAR(500);
ALTER TABLE consulenti ADD COLUMN IF NOT EXISTS specialita         VARCHAR(200);

-- ruolo: determina l'accesso a /admin/*. Gestito via proxy.ts a ogni request.
-- Blocco condizionale per idempotenza robusta su qualsiasi stato della colonna.
DO $$
BEGIN
  -- Caso 1: colonna assente → aggiungila come enum con default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'consulenti'
      AND column_name  = 'ruolo'
  ) THEN
    ALTER TABLE consulenti
      ADD COLUMN ruolo ruolo_consulente NOT NULL DEFAULT 'consulente';

  -- Caso 2: colonna presente come character varying → converti a enum
  -- (scenario teorico: in produzione la colonna è già ruolo_consulente)
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'consulenti'
      AND column_name  = 'ruolo'
      AND data_type    = 'character varying'
  ) THEN
    ALTER TABLE consulenti
      ALTER COLUMN ruolo TYPE ruolo_consulente
        USING ruolo::ruolo_consulente,
      ALTER COLUMN ruolo SET NOT NULL,
      ALTER COLUMN ruolo SET DEFAULT 'consulente';

  -- Caso 3: colonna già di tipo ruolo_consulente → nessuna azione necessaria
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 6. Indici nuovi
-- ---------------------------------------------------------------------------

-- auth_user_id: indice fondamentale, interrogato ad ogni request autenticata
CREATE INDEX IF NOT EXISTS idx_consulenti_auth_user  ON consulenti(auth_user_id);

-- Candidature: filtri pagina admin
CREATE INDEX IF NOT EXISTS idx_candidature_stato      ON candidature(stato);
CREATE INDEX IF NOT EXISTS idx_candidature_email      ON candidature(email);

-- Vini preferiti: lookup per consulente nella landing referral
CREATE INDEX IF NOT EXISTS idx_vini_pref_consulente   ON consulente_vini_preferiti(consulente_id);
