-- =============================================================================
-- InVinus — Migration 005: Registrazione sdoppiata + area cliente
-- Milestone: M4 (2026-04-25)
-- Scope: tabelle inviti_cliente + indirizzi_cliente, colonne clienti estese,
--        RPC crea_ordine_incaricato dual-mode, RPC nuove, RLS, column-level
-- Author: Claude Code (plan: docs/m4-piano.md)
-- NON IDEMPOTENTE — eseguire una sola volta in transazione fail-fast
-- =============================================================================

BEGIN;

-- §1 — Enum stato_cliente
-- =============================================================================
CREATE TYPE stato_cliente AS ENUM ('in_attesa_registrazione', 'attivo', 'sospeso');

-- §2 — Tabella inviti_cliente
-- =============================================================================
CREATE TABLE inviti_cliente (
  id               SERIAL PRIMARY KEY,
  incaricato_id    INT NOT NULL REFERENCES incaricati(id),
  cliente_email    VARCHAR(200) NOT NULL,
  token            UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  scadenza         TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  consumato        BOOLEAN NOT NULL DEFAULT FALSE,
  consumato_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(incaricato_id, cliente_email)
);

CREATE INDEX idx_inviti_cliente_incaricato ON inviti_cliente(incaricato_id);
CREATE INDEX idx_inviti_cliente_token     ON inviti_cliente(token);
CREATE INDEX idx_inviti_cliente_scadenza  ON inviti_cliente(scadenza);

-- §3 — Tabella indirizzi_cliente
-- =============================================================================
CREATE TABLE indirizzi_cliente (
  id             SERIAL PRIMARY KEY,
  cliente_id     INT NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
  tipo           VARCHAR(20) NOT NULL CHECK (tipo IN ('residenza', 'fatturazione', 'spedizione')),
  predefinito    BOOLEAN NOT NULL DEFAULT FALSE,
  nome_via       VARCHAR(200),
  numero_civico  VARCHAR(20),
  cap            VARCHAR(10),
  citta          VARCHAR(100),
  provincia      VARCHAR(2),
  nazione        VARCHAR(2) NOT NULL DEFAULT 'IT',
  pec            VARCHAR(200),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_indirizzi_cliente_cliente  ON indirizzi_cliente(cliente_id);
CREATE INDEX idx_indirizzi_cliente_tipo    ON indirizzi_cliente(cliente_id, tipo);

-- Trigger per unicita predefinito per tipo (solo 1 default per tipo per cliente)
CREATE OR REPLACE FUNCTION trg_indirizzo_unico_predefinito()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.predefinito = TRUE THEN
    UPDATE indirizzi_cliente
    SET predefinito = FALSE
    WHERE cliente_id = NEW.cliente_id
      AND tipo = NEW.tipo
      AND id IS DISTINCT FROM NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unico_predefinito_per_tipo
  BEFORE INSERT OR UPDATE ON indirizzi_cliente
  FOR EACH ROW EXECUTE FUNCTION trg_indirizzo_unico_predefinito();

-- §4 — Estensioni tabella clienti
-- =============================================================================
-- email gia nullable e unica (verificato: 4 clienti demo hanno email distinte non-NULL)
ALTER TABLE clienti ADD CONSTRAINT clienti_email_unique UNIQUE (email);

ALTER TABLE clienti ADD COLUMN auth_user_id UUID UNIQUE;
ALTER TABLE clienti ADD COLUMN codice_fiscale VARCHAR(16) UNIQUE;
ALTER TABLE clienti ADD COLUMN data_nascita DATE;
ALTER TABLE clienti ADD COLUMN stato stato_cliente NOT NULL DEFAULT 'in_attesa_registrazione';

-- CHECK constraint: CF e data_nascita obbligatori per cliente 'attivo'
-- I 4 clienti demo (stato in_attesa_registrazione) hanno CF/data_nascita NULL fino a M8
ALTER TABLE clienti ADD CONSTRAINT clienti_cf_required_if_attivo CHECK (
  stato = 'in_attesa_registrazione' OR codice_fiscale IS NOT NULL
);
ALTER TABLE clienti ADD CONSTRAINT clienti_data_nascita_required_if_attivo CHECK (
  stato = 'in_attesa_registrazione' OR data_nascita IS NOT NULL
);

-- §5 — Modifica body crea_ordine_incaricato (dual-mode: incaricato + cliente)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.crea_ordine_incaricato(
  p_cliente_id integer, p_tipo text, p_righe jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_incaricato_id INT;
  v_ordine_id     INT;
  v_cliente_id    INT;
  v_riga          JSONB;
  v_righe_arr     JSONB[];
  v_prod          RECORD;
  v_totale        NUMERIC := 0;
  v_pv_tot        NUMERIC := 0;
BEGIN
  -- DUAL MODE: se auth.uid() è un incaricato → usa current; se è un cliente → lookup incaricato_id
  SELECT id INTO v_incaricato_id FROM incaricati WHERE auth_user_id = auth.uid();
  IF v_incaricato_id IS NULL THEN
    -- Non è un incaricato: verifica se è un cliente
    SELECT id, incaricato_id INTO v_cliente_id, v_incaricato_id
    FROM clienti WHERE auth_user_id = auth.uid();
    IF v_cliente_id IS NULL THEN
      RAISE EXCEPTION 'Utente non trovato';
    END IF;
  END IF;

  -- BLOCCO SICUREZZA: incaricato che ordina per cliente → verifica appartenenza
  IF v_incaricato_id IS NOT NULL AND p_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM clienti WHERE id = p_cliente_id AND incaricato_id = v_incaricato_id
    ) THEN
      RAISE EXCEPTION 'Cliente % non appartiene a questo incaricato', p_cliente_id;
    END IF;
  END IF;

  INSERT INTO ordini (incaricato_id, cliente_id, data, stato, tipo, totale, pv_generati)
  VALUES (v_incaricato_id, COALESCE(p_cliente_id, v_cliente_id), NOW(), 'pagato', p_tipo::tipo_ordine, 0, 0)
  RETURNING id INTO v_ordine_id;

  SELECT array_agg(value) INTO v_righe_arr FROM jsonb_array_elements(p_righe);

  FOREACH v_riga IN ARRAY v_righe_arr
  LOOP
    SELECT prezzo_pubblico, pv_valore INTO v_prod
    FROM prodotti
    WHERE id = (v_riga->>'prodotto_id')::INT;

    INSERT INTO ordini_righe (ordine_id, prodotto_id, quantita, prezzo_unitario, pv_riga)
    VALUES (
      v_ordine_id,
      (v_riga->>'prodotto_id')::INT,
      (v_riga->>'quantita')::INT,
      v_prod.prezzo_pubblico,
      v_prod.pv_valore * (v_riga->>'quantita')::INT
    );

    v_totale := v_totale + v_prod.prezzo_pubblico * (v_riga->>'quantita')::INT;
    v_pv_tot := v_pv_tot + v_prod.pv_valore * (v_riga->>'quantita')::INT;
  END LOOP;

  UPDATE ordini SET totale = v_totale, pv_generati = v_pv_tot
  WHERE id = v_ordine_id;

  RETURN v_ordine_id;
END;
$$;

-- §6 — RPC nuove
-- =============================================================================

-- valida_token_invito — RPC pubblica per pagina /invito/[token] ( anonimo + authenticated )
-- Ritorna: valido, scadenza, nome/cognome incaricato, email cliente
CREATE OR REPLACE FUNCTION public.valida_token_invito(p_token UUID)
RETURNS TABLE(valido BOOLEAN, scadenza TIMESTAMPTZ, incaricato_nome VARCHAR, incaricato_cognome VARCHAR, cliente_email VARCHAR)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (i.consumato = FALSE AND i.scadenza > NOW()) AS valido,
    i.scadenza,
    inc.nome AS incaricato_nome,
    inc.cognome AS incaricato_cognome,
    i.cliente_email
  FROM inviti_cliente i
  JOIN incaricati inc ON i.incaricato_id = inc.id
  WHERE i.token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION valida_token_invito(UUID) TO anon, authenticated;

-- crea_invito_cliente
-- Input: p_nome, p_cognome, p_email, p_telefono
-- Output: token UUID
CREATE OR REPLACE FUNCTION public.crea_invito_cliente(
  p_nome VARCHAR, p_cognome VARCHAR, p_email VARCHAR, p_telefono VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_incaricato_id INT;
  v_cliente_id    INT;
  v_token        UUID;
BEGIN
  -- Validazione email
  IF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Formato email non valido';
  END IF;

  SELECT id INTO v_incaricato_id FROM incaricati WHERE auth_user_id = auth.uid();
  IF v_incaricato_id IS NULL THEN
    RAISE EXCEPTION 'Incaricato non trovato';
  END IF;

  -- Verifica che non esista già un cliente con quella email
  IF EXISTS (SELECT 1 FROM clienti WHERE email = p_email) THEN
    RAISE EXCEPTION 'Esiste già un cliente con questa email';
  END IF;

  -- Verifica che non ci sia già un invito pendente per questa email da questo incaricato
  IF EXISTS (
    SELECT 1 FROM inviti_cliente
    WHERE cliente_email = p_email AND incaricato_id = v_incaricato_id AND consumato = FALSE
    AND scadenza > NOW()
  ) THEN
    RAISE EXCEPTION 'Esiste già un invito pendente per questa email';
  END IF;

  -- Crea record clienti (stato in_attesa_registrazione, no auth_user_id)
  INSERT INTO clienti (nome, cognome, email, telefono, incaricato_id, stato)
  VALUES (p_nome, p_cognome, p_email, p_telefono, v_incaricato_id, 'in_attesa_registrazione')
  RETURNING id INTO v_cliente_id;

  -- Crea record inviti_cliente
  INSERT INTO inviti_cliente (incaricato_id, cliente_email, token, scadenza, consumato)
  VALUES (v_incaricato_id, p_email, uuid_generate_v4(), NOW() + INTERVAL '30 days', FALSE)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

-- completa_registrazione_cliente
-- NOTE: Flusso corretto prevede creazione auth user lato client TS con
--   supabase.auth.admin.createUser({ email, password }) PRIMA di chiamare questa RPC.
--   L'auth_user_id viene passato come parametro p_auth_user_id.
-- Input: p_token, p_auth_user_id, p_data_nascita, p_codice_fiscale, indirizzo residenza,
--        p_fatturazione_uguale, indirizzi fatturazione/spedizione (opt)
-- Output: cliente_id
CREATE OR REPLACE FUNCTION public.completa_registrazione_cliente(
  p_token                UUID,
  p_auth_user_id         UUID,
  p_data_nascita         DATE,
  p_codice_fiscale       VARCHAR(16),
  p_residenza_nome_via   VARCHAR(200),
  p_residenza_numero     VARCHAR(20),
  p_residenza_cap        VARCHAR(10),
  p_residenza_citta      VARCHAR(100),
  p_residenza_provincia  VARCHAR(2),
  p_fatturazione_uguale  BOOLEAN DEFAULT TRUE,
  p_fatt_nome_via       VARCHAR(200) DEFAULT NULL,
  p_fatt_numero         VARCHAR(20) DEFAULT NULL,
  p_fatt_cap            VARCHAR(10) DEFAULT NULL,
  p_fatt_citta          VARCHAR(100) DEFAULT NULL,
  p_fatt_provincia      VARCHAR(2) DEFAULT NULL,
  p_sped_nome_via       VARCHAR(200) DEFAULT NULL,
  p_sped_numero         VARCHAR(20) DEFAULT NULL,
  p_sped_cap            VARCHAR(10) DEFAULT NULL,
  p_sped_citta          VARCHAR(100) DEFAULT NULL,
  p_sped_provincia      VARCHAR(2) DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invito        RECORD;
  v_cliente_id    INT;
BEGIN
  -- Validazione token
  SELECT id, incaricato_id INTO v_invito
  FROM inviti_cliente
  WHERE token = p_token AND consumato = FALSE AND scadenza > NOW();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token non valido o scaduto';
  END IF;

  -- Verifica età >= 18
  IF p_data_nascita > (NOW()::DATE - INTERVAL '18 years')::DATE THEN
    RAISE EXCEPTION 'Devi avere almeno 18 anni per registrarti';
  END IF;

  -- Aggiorna record clienti (auth_user_id gia creato esternamente in TS)
  UPDATE clienti
  SET auth_user_id = p_auth_user_id,
      codice_fiscale = p_codice_fiscale,
      data_nascita = p_data_nascita,
      stato = 'attivo'
  WHERE email = (SELECT cliente_email FROM inviti_cliente WHERE token = p_token)
  RETURNING id INTO v_cliente_id;

  -- Segna invito come consumato
  UPDATE inviti_cliente
  SET consumato = TRUE, consumato_at = NOW()
  WHERE token = p_token;

  -- Inserisci 3 record indirizzi (residenza obbligatoria, fatturazione+spedizione se diverse)
  INSERT INTO indirizzi_cliente (cliente_id, tipo, predefinito, nome_via, numero_civico, cap, citta, provincia)
  VALUES (v_cliente_id, 'residenza', TRUE, p_residenza_nome_via, p_residenza_numero, p_residenza_cap, p_residenza_citta, p_residenza_provincia);

  IF NOT p_fatturazione_uguale THEN
    INSERT INTO indirizzi_cliente (cliente_id, tipo, predefinito, nome_via, numero_civico, cap, citta, provincia, pec)
    VALUES (v_cliente_id, 'fatturazione', TRUE, p_fatt_nome_via, p_fatt_numero, p_fatt_cap, p_fatt_citta, p_fatt_provincia, NULL);
    INSERT INTO indirizzi_cliente (cliente_id, tipo, predefinito, nome_via, numero_civico, cap, citta, provincia)
    VALUES (v_cliente_id, 'spedizione', TRUE, p_sped_nome_via, p_sped_numero, p_sped_cap, p_sped_citta, p_sped_provincia);
  ELSE
    -- Copia residenza come fatturazione e spedizione (non-predefiniti)
    INSERT INTO indirizzi_cliente (cliente_id, tipo, predefinito, nome_via, numero_civico, cap, citta, provincia)
    VALUES (v_cliente_id, 'fatturazione', FALSE, p_residenza_nome_via, p_residenza_numero, p_residenza_cap, p_residenza_citta, p_residenza_provincia);
    INSERT INTO indirizzi_cliente (cliente_id, tipo, predefinito, nome_via, numero_civico, cap, citta, provincia)
    VALUES (v_cliente_id, 'spedizione', FALSE, p_residenza_nome_via, p_residenza_numero, p_residenza_cap, p_residenza_citta, p_residenza_provincia);
  END IF;

  RETURN v_cliente_id;
END;
$$;

-- current_cliente_id
CREATE OR REPLACE FUNCTION public.current_cliente_id()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM clienti WHERE auth_user_id = auth.uid();
$$;

-- rigenera_invito_cliente
-- Input: p_cliente_id
-- Output: nuovo token UUID
CREATE OR REPLACE FUNCTION public.rigenera_invito_cliente(p_cliente_id INT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_incaricato_id INT;
  v_cliente      RECORD;
  v_token        UUID;
BEGIN
  SELECT id, incaricato_id, email INTO v_cliente
  FROM clienti WHERE id = p_cliente_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente non trovato';
  END IF;

  SELECT id INTO v_incaricato_id FROM incaricati WHERE auth_user_id = auth.uid();
  IF v_cliente.incaricato_id != v_incaricato_id THEN
    RAISE EXCEPTION 'Cliente non appartiene a questo incaricato';
  END IF;

  IF v_cliente.stato != 'in_attesa_registrazione' THEN
    RAISE EXCEPTION 'Cliente non in attesa di registrazione';
  END IF;

  -- Segna vecchi inviti come consumati
  UPDATE inviti_cliente SET consumato = TRUE, consumato_at = NOW()
  WHERE cliente_email = v_cliente.email AND consumato = FALSE;

  -- Genera nuovo token
  INSERT INTO inviti_cliente (incaricato_id, cliente_email, token, scadenza, consumato)
  VALUES (v_incaricato_id, v_cliente.email, uuid_generate_v4(), NOW() + INTERVAL '30 days', FALSE)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

-- §7 — Trigger gia definito in §3

-- §8 — RLS nuove policy
-- =============================================================================

-- clienti
CREATE POLICY cli_select_own ON clienti FOR SELECT
  TO authenticated USING (auth_user_id = auth.uid());

CREATE POLICY cli_insert_by_incaricato ON clienti FOR INSERT
  TO authenticated WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY cli_update_own ON clienti FOR UPDATE
  TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

-- inviti_cliente
CREATE POLICY invcli_insert ON inviti_cliente FOR INSERT
  TO authenticated WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY invcli_select ON inviti_cliente FOR SELECT
  TO authenticated USING (incaricato_id = current_incaricato_id());

CREATE POLICY invcli_update ON inviti_cliente FOR UPDATE
  TO authenticated USING (incaricato_id = current_incaricato_id()) WITH CHECK (incaricato_id = current_incaricato_id());

-- indirizzi_cliente
CREATE POLICY indcli_select ON indirizzi_cliente FOR SELECT
  TO authenticated USING (cliente_id IN (SELECT id FROM clienti WHERE auth_user_id = auth.uid()));

CREATE POLICY indcli_insert ON indirizzi_cliente FOR INSERT
  TO authenticated WITH CHECK (cliente_id IN (SELECT id FROM clienti WHERE auth_user_id = auth.uid()));

CREATE POLICY indcli_update ON indirizzi_cliente FOR UPDATE
  TO authenticated USING (cliente_id IN (SELECT id FROM clienti WHERE auth_user_id = auth.uid())) WITH CHECK (cliente_id IN (SELECT id FROM clienti WHERE auth_user_id = auth.uid()));

-- ordini (cliente vede i propri ordini)
CREATE POLICY ordcli_select ON ordini FOR SELECT
  TO authenticated USING (cliente_id IN (SELECT id FROM clienti WHERE auth_user_id = auth.uid()));

-- admin_all su tabelle nuove (non coperte da admin_all M2)
CREATE POLICY admin_all ON inviti_cliente FOR ALL
  TO authenticated USING (current_is_admin()) WITH CHECK (current_is_admin());

CREATE POLICY admin_all ON indirizzi_cliente FOR ALL
  TO authenticated USING (current_is_admin()) WITH CHECK (current_is_admin());

-- §9 — Column-level REVOKE/GRANT su clienti
-- =============================================================================
REVOKE UPDATE ON clienti FROM authenticated;
GRANT UPDATE (nome, cognome, telefono) ON clienti TO authenticated;

COMMIT;
