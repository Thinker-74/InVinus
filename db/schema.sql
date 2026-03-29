-- =============================================================================
-- InVinus — Schema PostgreSQL completo + Seed dati catalogo
-- Generato da: docs/01..12 (business overview, catalogo, compensation plan,
--              requisiti tech, flussi, cantina/magazzino, edge cases)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA  IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;  -- per full-text search su prodotti


-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------

CREATE TYPE status_consulente AS ENUM (
  'STARTER',
  'APPRENTICE',
  'ADVISOR',
  'SUPERVISOR',
  'TEAM_COORDINATOR',
  'MANAGER',
  'DIRECTOR',
  'AMBASSADOR',
  'GOLDEN'
);

CREATE TYPE tipo_vino AS ENUM ('rosso', 'bianco', 'rosato', 'spumante');

-- DOP usata per Campania (equivalente EU di DOC/DOCG), IGT copre anche "IGT Bianco"
CREATE TYPE denominazione_vino AS ENUM ('DOP', 'DOCG', 'DOC', 'IGT');

CREATE TYPE stato_ordine AS ENUM (
  'nuovo',
  'pagato',
  'in_preparazione',
  'spedito',
  'consegnato',
  'annullato',
  'reso'
);

CREATE TYPE stato_funnel_lead AS ENUM (
  'nuovo',
  'contattato',
  'invitato_serata',
  'partecipato_serata',
  'cliente',
  'consulente',
  'perso'
);

CREATE TYPE tipo_evento AS ENUM (
  'serata_degustazione',
  'wine_party',
  'webinar',
  'formazione'
);

CREATE TYPE stato_partecipante AS ENUM (
  'invitato',
  'confermato',
  'presente',
  'assente'
);

CREATE TYPE stato_pagamento_prov AS ENUM (
  'calcolato',
  'approvato',
  'pagato',
  'sospeso'
);

CREATE TYPE stato_account_consulente AS ENUM (
  'attivo',
  'sospeso',
  'dormiente',   -- inattivo da 12+ mesi (doc 12 §3)
  'cancellato'   -- GDPR art.17 — dati anonimizzati
);

CREATE TYPE tipo_ordine AS ENUM ('vendita', 'autoconsumo', 'b2b');

CREATE TYPE tipo_movimento_magazzino AS ENUM (
  'CARICO',
  'VENDITA',
  'DEGUSTAZIONE',
  'OMAGGIO',
  'RESO',
  'ROTTURA',
  'AUTOCONSUMO'
);

CREATE TYPE origine_magazzino AS ENUM (
  'ACQUISTO_PERSONALE',
  'CAMPIONE_GRATUITO',
  'OMAGGIO_PROMO',
  'STARTER_KIT'
);

CREATE TYPE stato_cantina_personale AS ENUM ('IN_CANTINA', 'CONSUMATA', 'REGALATA');

CREATE TYPE motivo_storno AS ENUM ('reso_14gg', 'reso_goodwill', 'annullamento');


-- =============================================================================
-- TABELLE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Regioni vinicole
-- ---------------------------------------------------------------------------
CREATE TABLE regioni (
  id   SERIAL PRIMARY KEY,
  nome VARCHAR(50) NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------------
-- Cantine fornitrici
-- ---------------------------------------------------------------------------
CREATE TABLE cantine_fornitrici (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(150) NOT NULL,
  regione_id  INT NOT NULL REFERENCES regioni(id),
  indirizzo   TEXT,
  telefono    VARCHAR(20),
  email       VARCHAR(150),
  referente   VARCHAR(100),
  note        TEXT,
  attiva      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Prodotti — catalogo vini
-- ---------------------------------------------------------------------------
CREATE TABLE prodotti (
  id                    SERIAL PRIMARY KEY,
  nome                  VARCHAR(200) NOT NULL,
  denominazione         denominazione_vino NOT NULL,
  tipo                  tipo_vino NOT NULL,
  regione_id            INT NOT NULL REFERENCES regioni(id),
  cantina_fornitrice_id INT REFERENCES cantine_fornitrici(id),
  annata                SMALLINT,                              -- NULL = non millésimé
  alcol                 DECIMAL(4,1) NOT NULL,
  temp_servizio_min     SMALLINT NOT NULL,
  temp_servizio_max     SMALLINT NOT NULL,
  prezzo_pubblico       DECIMAL(8,2) NOT NULL,
  prezzo_consulente     DECIMAL(8,2) NOT NULL,                 -- prezzo acquisto consulente
  costo_fornitore       DECIMAL(8,2),                         -- confidenziale, solo admin
  pv_valore             INT NOT NULL DEFAULT 0,               -- PV per bottiglia venduta
  scheda_narrativa      TEXT,
  abbinamenti           TEXT,
  disponibile           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_temp_range     CHECK (temp_servizio_min <= temp_servizio_max),
  CONSTRAINT chk_prezzo_pos     CHECK (prezzo_pubblico > 0),
  CONSTRAINT chk_prezzo_cons    CHECK (prezzo_consulente > 0),
  CONSTRAINT chk_alcol_range    CHECK (alcol BETWEEN 5 AND 25)
);

-- ---------------------------------------------------------------------------
-- Qualifiche — lookup piano compensi (doc 02)
-- Ordinamento enum = ordinamento carriera, quindi >= funziona correttamente
-- ---------------------------------------------------------------------------
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
  cab_importo          DECIMAL(6,2) NOT NULL DEFAULT 0,        -- €/consulente attivo
  ha_bonus_car         BOOLEAN NOT NULL DEFAULT FALSE,
  ha_global_pool       BOOLEAN NOT NULL DEFAULT FALSE
);

-- ---------------------------------------------------------------------------
-- Consulenti — anagrafica + albero genealogico (auto-join sponsor_id)
-- ---------------------------------------------------------------------------
CREATE TABLE consulenti (
  id                        SERIAL PRIMARY KEY,
  nome                      VARCHAR(100) NOT NULL,
  cognome                   VARCHAR(100) NOT NULL,
  email                     VARCHAR(200) NOT NULL UNIQUE,
  telefono                  VARCHAR(20),
  codice_fiscale            VARCHAR(16) UNIQUE,                -- unicità: 1 persona = 1 account
  sponsor_id                INT REFERENCES consulenti(id),     -- NULL = top of tree
  status                    status_consulente NOT NULL DEFAULT 'STARTER',
  status_max                status_consulente NOT NULL DEFAULT 'STARTER',  -- non retrocede mai
  pv_mese_corrente          DECIMAL(10,2) NOT NULL DEFAULT 0,
  gv_mese_corrente          DECIMAL(10,2) NOT NULL DEFAULT 0,
  attivo                    BOOLEAN NOT NULL DEFAULT TRUE,      -- soddisfa PV requisito mensile
  formazione_completata     BOOLEAN NOT NULL DEFAULT FALSE,    -- intermezzo TEAM_COORD→MANAGER
  link_referral             VARCHAR(100) UNIQUE,
  stripe_account_id         VARCHAR(100),
  stato_account             stato_account_consulente NOT NULL DEFAULT 'attivo',
  data_iscrizione           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_ultimo_status_change TIMESTAMPTZ,
  approvato_da              INT REFERENCES consulenti(id),
  approvato_il              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- status_max non può essere inferiore a status corrente
  CONSTRAINT chk_status_max CHECK (status_max >= status)
);

-- ---------------------------------------------------------------------------
-- Clienti finali
-- ---------------------------------------------------------------------------
CREATE TABLE clienti (
  id                   SERIAL PRIMARY KEY,
  nome                 VARCHAR(100) NOT NULL,
  cognome              VARCHAR(100) NOT NULL,
  email                VARCHAR(200) UNIQUE,
  telefono             VARCHAR(20),
  consulente_id        INT REFERENCES consulenti(id),
  data_primo_acquisto  TIMESTAMPTZ,
  segmento             VARCHAR(50),                            -- wine_lover, horeca, regalo
  note                 TEXT,
  gdpr_consenso        BOOLEAN NOT NULL DEFAULT FALSE,
  gdpr_data_consenso   TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Lead — pipeline funnel consulente
-- ---------------------------------------------------------------------------
CREATE TABLE lead (
  id                        SERIAL PRIMARY KEY,
  nome                      VARCHAR(100),
  cognome                   VARCHAR(100),
  email                     VARCHAR(200),
  telefono                  VARCHAR(20),
  fonte                     VARCHAR(50),                       -- serata, social, referral, sito
  consulente_id             INT REFERENCES consulenti(id),
  stato_funnel              stato_funnel_lead NOT NULL DEFAULT 'nuovo',
  data_contatto             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note                      TEXT,
  convertito_cliente_id     INT REFERENCES clienti(id),
  convertito_consulente_id  INT REFERENCES consulenti(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Ordini
-- PV si generano al pagamento (stato = 'pagato') — doc 12 §1 decisione suggerita
-- ---------------------------------------------------------------------------
CREATE TABLE ordini (
  id                   SERIAL PRIMARY KEY,
  cliente_id           INT REFERENCES clienti(id),             -- NULL se autoconsumo
  consulente_id        INT NOT NULL REFERENCES consulenti(id),
  data                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  totale               DECIMAL(10,2) NOT NULL DEFAULT 0,
  stato                stato_ordine NOT NULL DEFAULT 'nuovo',
  tipo                 tipo_ordine NOT NULL DEFAULT 'vendita',
  stripe_payment_id    VARCHAR(200),
  tracking_code        VARCHAR(100),
  indirizzo_spedizione TEXT,
  pv_generati          DECIMAL(10,2) NOT NULL DEFAULT 0,       -- 0 fino a stato='pagato'
  note                 TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Righe ordine
-- ---------------------------------------------------------------------------
CREATE TABLE ordini_righe (
  id              SERIAL PRIMARY KEY,
  ordine_id       INT NOT NULL REFERENCES ordini(id) ON DELETE CASCADE,
  prodotto_id     INT NOT NULL REFERENCES prodotti(id),
  quantita        INT NOT NULL CHECK (quantita > 0),
  prezzo_unitario DECIMAL(8,2) NOT NULL,
  pv_riga         DECIMAL(8,2) NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Storni PV — doc 12 §1: resi stornano PV del mese di competenza
-- ---------------------------------------------------------------------------
CREATE TABLE storni_pv (
  id             SERIAL PRIMARY KEY,
  ordine_id      INT NOT NULL REFERENCES ordini(id),
  consulente_id  INT NOT NULL REFERENCES consulenti(id),
  pv_stornati    DECIMAL(10,2) NOT NULL CHECK (pv_stornati > 0),
  anno           SMALLINT NOT NULL,
  mese           SMALLINT NOT NULL CHECK (mese BETWEEN 1 AND 12),
  motivo         motivo_storno NOT NULL,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Provvigioni mensili
-- Calcolate dal job batch nell'ordine: storni → PV/GV → attività → promozioni → bonus → payout
-- ---------------------------------------------------------------------------
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
  -- breakdown per livello: {"l1": 120.50, "l2": 45.00, ...}
  residuale_dettaglio   JSONB,
  cab_bonus             DECIMAL(10,2) NOT NULL DEFAULT 0,
  bonus_car             DECIMAL(10,2) NOT NULL DEFAULT 0,
  global_pool           DECIMAL(10,2) NOT NULL DEFAULT 0,
  totale                DECIMAL(10,2) NOT NULL DEFAULT 0,
  stato                 stato_pagamento_prov NOT NULL DEFAULT 'calcolato',
  data_calcolo          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_pagamento        TIMESTAMPTZ,
  UNIQUE(consulente_id, anno, mese)
);

-- ---------------------------------------------------------------------------
-- Serate ed eventi
-- ---------------------------------------------------------------------------
CREATE TABLE eventi (
  id                       SERIAL PRIMARY KEY,
  consulente_id            INT NOT NULL REFERENCES consulenti(id),
  tipo                     tipo_evento NOT NULL DEFAULT 'serata_degustazione',
  data                     TIMESTAMPTZ NOT NULL,
  luogo                    VARCHAR(200),
  partecipanti_previsti    INT,
  partecipanti_effettivi   INT,
  note                     TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Partecipanti eventi
-- FK dinamica verso lead / clienti / consulenti tramite (tipo_partecipante, riferimento_id)
-- ---------------------------------------------------------------------------
CREATE TABLE eventi_partecipanti (
  id                       SERIAL PRIMARY KEY,
  evento_id                INT NOT NULL REFERENCES eventi(id) ON DELETE CASCADE,
  tipo_partecipante        VARCHAR(20) NOT NULL
                             CHECK (tipo_partecipante IN ('lead', 'cliente', 'consulente')),
  riferimento_id           INT NOT NULL,
  stato                    stato_partecipante NOT NULL DEFAULT 'invitato',
  ordine_post_evento_id    INT REFERENCES ordini(id)
);

-- ---------------------------------------------------------------------------
-- Interazioni CRM — log storico contatti
-- ---------------------------------------------------------------------------
CREATE TABLE interazioni_crm (
  id                SERIAL PRIMARY KEY,
  consulente_id     INT NOT NULL REFERENCES consulenti(id),
  tipo_soggetto     VARCHAR(20) NOT NULL
                      CHECK (tipo_soggetto IN ('lead', 'cliente', 'consulente')),
  soggetto_id       INT NOT NULL,
  tipo_interazione  VARCHAR(50) NOT NULL,   -- chiamata, email, serata, whatsapp, sms
  data              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note              TEXT,
  esito             VARCHAR(100)
);

-- ---------------------------------------------------------------------------
-- Cantina personale (doc 10) — per clienti E consulenti
-- ---------------------------------------------------------------------------
CREATE TABLE cantina_personale (
  id                  SERIAL PRIMARY KEY,
  utente_id           INT NOT NULL,
  utente_tipo         VARCHAR(20) NOT NULL
                        CHECK (utente_tipo IN ('CONSULENTE', 'CLIENTE')),
  prodotto_id         INT NOT NULL REFERENCES prodotti(id),
  quantita            INT NOT NULL DEFAULT 1 CHECK (quantita >= 0),
  stato               stato_cantina_personale NOT NULL DEFAULT 'IN_CANTINA',
  data_aggiunta       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_consumo        TIMESTAMPTZ,
  nota_degustazione   TEXT,
  punteggio_personale SMALLINT CHECK (punteggio_personale BETWEEN 1 AND 5),
  occasione           VARCHAR(255),
  in_wishlist         BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(utente_id, utente_tipo, prodotto_id, data_aggiunta)
);

-- ---------------------------------------------------------------------------
-- Magazzino operativo consulente (doc 10)
-- ---------------------------------------------------------------------------
CREATE TABLE magazzino_consulente (
  id                    SERIAL PRIMARY KEY,
  consulente_id         INT NOT NULL REFERENCES consulenti(id),
  prodotto_id           INT NOT NULL REFERENCES prodotti(id),
  quantita_disponibile  INT NOT NULL DEFAULT 0 CHECK (quantita_disponibile >= 0),
  quantita_riservata    INT NOT NULL DEFAULT 0 CHECK (quantita_riservata >= 0),
  scorta_minima         INT NOT NULL DEFAULT 2 CHECK (scorta_minima >= 0),
  data_ultimo_carico    DATE,
  data_ultima_uscita    DATE,
  UNIQUE(consulente_id, prodotto_id),
  -- REGOLA 2 doc 10: non riservare più di quanto si possiede
  CONSTRAINT chk_riservata CHECK (quantita_riservata <= quantita_disponibile)
);

-- ---------------------------------------------------------------------------
-- Movimenti magazzino — log immutabile (doc 10)
-- REGOLA 3/4: ogni movimento aggiorna quantita_disponibile nella stessa transazione
-- ---------------------------------------------------------------------------
CREATE TABLE movimenti_magazzino (
  id               SERIAL PRIMARY KEY,
  magazzino_id     INT NOT NULL REFERENCES magazzino_consulente(id),
  tipo             tipo_movimento_magazzino NOT NULL,
  quantita         INT NOT NULL,    -- positivo = carico, negativo = uscita
  data             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  riferimento_tipo VARCHAR(20) CHECK (riferimento_tipo IN ('ORDINE', 'EVENTO')),
  riferimento_id   INT,
  origine          origine_magazzino,
  note             TEXT
);

-- ---------------------------------------------------------------------------
-- Box degustazione — kit pre-composti (doc 10)
-- ---------------------------------------------------------------------------
CREATE TABLE box_degustazione (
  id                SERIAL PRIMARY KEY,
  nome              VARCHAR(100) NOT NULL,
  descrizione       TEXT,
  prezzo_pubblico   DECIMAL(8,2) NOT NULL,
  prezzo_consulente DECIMAL(8,2) NOT NULL,
  pv_valore         INT NOT NULL DEFAULT 0,
  attivo            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE box_degustazione_righe (
  id          SERIAL PRIMARY KEY,
  box_id      INT NOT NULL REFERENCES box_degustazione(id) ON DELETE CASCADE,
  prodotto_id INT NOT NULL REFERENCES prodotti(id),
  quantita    INT NOT NULL DEFAULT 1 CHECK (quantita > 0)
);


-- =============================================================================
-- INDICI
-- =============================================================================

-- Consulenti — ricerca per sponsor (percorso albero genealogico)
CREATE INDEX idx_consulenti_sponsor    ON consulenti(sponsor_id);
CREATE INDEX idx_consulenti_status     ON consulenti(status);
CREATE INDEX idx_consulenti_email      ON consulenti(email);
CREATE INDEX idx_consulenti_cf         ON consulenti(codice_fiscale);
CREATE INDEX idx_consulenti_referral   ON consulenti(link_referral);

-- Ordini
CREATE INDEX idx_ordini_cliente        ON ordini(cliente_id);
CREATE INDEX idx_ordini_consulente     ON ordini(consulente_id);
CREATE INDEX idx_ordini_stato          ON ordini(stato);
CREATE INDEX idx_ordini_data           ON ordini(data);
CREATE INDEX idx_ordini_righe_ordine   ON ordini_righe(ordine_id);
CREATE INDEX idx_ordini_righe_prodotto ON ordini_righe(prodotto_id);

-- Prodotti — ricerca full-text su nome
CREATE INDEX idx_prodotti_nome_trgm    ON prodotti USING gin(nome gin_trgm_ops);
CREATE INDEX idx_prodotti_tipo         ON prodotti(tipo);
CREATE INDEX idx_prodotti_regione      ON prodotti(regione_id);
CREATE INDEX idx_prodotti_disponibile  ON prodotti(disponibile);

-- Provvigioni
CREATE INDEX idx_prov_consulente_mese  ON provvigioni_mensili(consulente_id, anno, mese);
CREATE INDEX idx_prov_stato            ON provvigioni_mensili(stato);

-- Storni
CREATE INDEX idx_storni_mese           ON storni_pv(consulente_id, anno, mese);

-- Lead
CREATE INDEX idx_lead_consulente       ON lead(consulente_id);
CREATE INDEX idx_lead_funnel           ON lead(stato_funnel);

-- Clienti
CREATE INDEX idx_clienti_consulente    ON clienti(consulente_id);

-- Magazzino
CREATE INDEX idx_mag_consulente        ON magazzino_consulente(consulente_id);
CREATE INDEX idx_mov_magazzino_data    ON movimenti_magazzino(magazzino_id, data);
-- Indice parziale per query alert scorta bassa
CREATE INDEX idx_mag_alert             ON magazzino_consulente(consulente_id)
  WHERE quantita_disponibile <= scorta_minima;

-- Cantina personale
CREATE INDEX idx_cantina_utente        ON cantina_personale(utente_id, utente_tipo);
CREATE INDEX idx_cantina_prodotto      ON cantina_personale(prodotto_id);

-- Interazioni CRM
CREATE INDEX idx_crm_consulente        ON interazioni_crm(consulente_id);
CREATE INDEX idx_crm_soggetto          ON interazioni_crm(tipo_soggetto, soggetto_id);


-- =============================================================================
-- SEED DATI
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Regioni
-- ---------------------------------------------------------------------------
INSERT INTO regioni (id, nome) VALUES
  (1, 'Campania'),
  (2, 'Toscana'),
  (3, 'Umbria'),
  (4, 'Veneto');

SELECT setval('regioni_id_seq', 4);

-- ---------------------------------------------------------------------------
-- Cantine fornitrici (una per regione — nomi fittizi, da sostituire con accordi reali)
-- ---------------------------------------------------------------------------
INSERT INTO cantine_fornitrici (id, nome, regione_id, indirizzo, referente, attiva) VALUES
  (1, 'Cantina San Marco del Sannio',    1, 'Contrada San Marco, Castelvenere (BN)', 'Aldo Ferrara',    TRUE),
  (2, 'Fattoria dei Colli Toscani',      2, 'Via della Vigna 12, Montalcino (SI)',    'Elena Bianchi',   TRUE),
  (3, 'Tenuta Umbra di Montefalco',      3, 'Strada del Sagrantino 8, Montefalco (PG)', 'Marco Rosati',  TRUE),
  (4, 'Villa Valpolicella',              4, 'Via Amarone 3, Negrar (VR)',             'Sara Venturini',  TRUE);

SELECT setval('cantine_fornitrici_id_seq', 4);

-- ---------------------------------------------------------------------------
-- Qualifiche — piano compensi (doc 02)
-- ---------------------------------------------------------------------------
INSERT INTO qualifiche (
  status, pv_min, gv_min,
  provvigione_pers,
  residuale_l1, residuale_l2, residuale_l3, residuale_l4,
  residuale_l5, residuale_l6, residuale_l7, residuale_l8,
  cab_importo, ha_bonus_car, ha_global_pool
) VALUES
-- STARTER: solo provvigione personale, nessun reddito residuale
('STARTER',         0,       0,    0.15,    0,      0,      0,      0,      0,     0,     0,     0,    0,    FALSE, FALSE),
-- APPRENTICE: 1 livello al 60%
('APPRENTICE',     50,      50,    0.15,    0.60,   0,      0,      0,      0,     0,     0,     0,    0,    FALSE, FALSE),
-- ADVISOR: 2 livelli al 30% ciascuno
('ADVISOR',        50,     150,    0.15,    0.30,   0.30,   0,      0,      0,     0,     0,     0,    0,    FALSE, FALSE),
-- SUPERVISOR: 3 livelli al 20%
('SUPERVISOR',     50,     500,    0.15,    0.20,   0.20,   0.20,   0,      0,     0,     0,     0,    0,    FALSE, FALSE),
-- TEAM COORDINATOR: 4 livelli al 15%
('TEAM_COORDINATOR',50,   1500,    0.15,    0.15,   0.15,   0.15,   0.15,   0,     0,     0,     0,    0,    FALSE, FALSE),
-- MANAGER: 4 livelli al 15% + L5 al 3% (intermezzo formativo richiesto)
('MANAGER',        80,   15000,    0.15,    0.15,   0.15,   0.15,   0.15,   0.03,  0,     0,     0,    0,    FALSE, FALSE),
-- DIRECTOR: +L6 al 2% + CAB 1€/consulente attivo
('DIRECTOR',      100,   50000,    0.15,    0.15,   0.15,   0.15,   0.15,   0.03,  0.02,  0,     0,    1.00, FALSE, FALSE),
-- AMBASSADOR: +L7 al 1% + CAB 2€ + Bonus Car
('AMBASSADOR',    120,  100000,    0.15,    0.15,   0.15,   0.15,   0.15,   0.03,  0.02,  0.01,  0,    2.00, TRUE,  FALSE),
-- GOLDEN: +L8 al 1% + CAB 3€ + Bonus Car + Global Pool (3% fatturato annuo)
('GOLDEN',        150,  100000,    0.15,    0.15,   0.15,   0.15,   0.15,   0.03,  0.02,  0.01,  0.01, 3.00, TRUE,  TRUE);

-- ---------------------------------------------------------------------------
-- Prodotti — catalogo 2026 completo (30 referenze, doc 03)
-- Prezzi: pubblico / consulente / costo fornitore (confidenziale)
-- PV: ≈ prezzo_consulente arrotondato all'intero
-- ---------------------------------------------------------------------------

-- --- CAMPANIA (cantina_id = 1) ---
INSERT INTO prodotti (
  id, nome, denominazione, tipo,
  regione_id, cantina_fornitrice_id,
  annata, alcol, temp_servizio_min, temp_servizio_max,
  prezzo_pubblico, prezzo_consulente, costo_fornitore, pv_valore,
  disponibile
) VALUES
-- Rossi Campania
(1,  'Aglianico del Sannio Riserva',    'DOP', 'rosso',    1, 1, 2022, 14.0, 16, 18,  18.90, 13.50,  8.00,  13, TRUE),
(2,  'Aglianico del Sannio',            'DOP', 'rosso',    1, 1, 2024, 13.5, 16, 18,  13.90,  9.90,  5.50,   9, TRUE),
(3,  'Barbera del Sannio',              'DOP', 'rosso',    1, 1, 2023, 13.5, 16, 18,  12.90,  9.20,  5.00,   9, TRUE),
-- Bianchi Campania
(4,  'Falanghina del Sannio',           'DOP', 'bianco',   1, 1, 2024, 13.5,  8,  9,  12.90,  9.20,  5.00,   9, TRUE),
(5,  'Greco del Sannio',                'DOP', 'bianco',   1, 1, 2024, 13.5,  8,  9,  13.50,  9.60,  5.20,   9, TRUE),
(6,  'Fiano del Sannio',                'DOP', 'bianco',   1, 1, 2024, 13.5,  8,  9,  13.50,  9.60,  5.20,   9, TRUE),
(7,  'Coda di Volpe del Sannio',        'DOP', 'bianco',   1, 1, 2024, 13.0,  8,  9,  11.90,  8.50,  4.50,   8, TRUE),
-- Spumanti Campania
(8,  'Falanghina del Sannio VSQ Brut',  'DOP', 'spumante', 1, 1, 2024, 12.0,  6,  8,  14.90, 10.60,  6.00,  10, TRUE),

-- --- TOSCANA (cantina_id = 2) ---
-- Rossi Toscana
(9,  'Chianti Classico',                'DOCG','rosso',    2, 2, 2020, 15.5, 18, 20,  22.90, 16.30, 10.00,  16, TRUE),
(10, 'Chianti Classico Riserva',        'DOCG','rosso',    2, 2, 2019, 14.5, 18, 20,  32.90, 23.40, 15.00,  23, TRUE),
(11, 'Brunello di Montalcino',          'DOCG','rosso',    2, 2, 2021, 15.5, 18, 20,  68.90, 49.00, 32.00,  49, TRUE),
(12, 'Rosso di Montalcino',             'DOC', 'rosso',    2, 2, 2023, 13.5, 18, 20,  24.90, 17.70, 11.00,  17, TRUE),
(13, 'Poggio Torto Toscana',            'IGT', 'rosso',    2, 2, 2024, 13.5, 18, 20,  16.90, 12.00,  7.00,  12, TRUE),
(14, 'Sant''Antimo',                    'DOC', 'rosso',    2, 2, 2024, 14.5, 18, 20,  18.90, 13.50,  8.00,  13, TRUE),
-- Bianchi Toscana
(15, 'Vermentino Toscana',              'IGT', 'bianco',   2, 2, 2023, 14.0,  8, 10,  15.90, 11.30,  6.50,  11, TRUE),
(16, 'Sant''Antimo Bianco',             'DOC', 'bianco',   2, 2, 2025, 12.0,  8, 10,  14.90, 10.60,  6.00,  10, TRUE),
-- Rosati Toscana
(17, 'Rosato Toscana',                  'IGT', 'rosato',   2, 2, 2025, 13.0,  8, 10,  13.90,  9.90,  5.50,   9, TRUE),

-- --- UMBRIA (cantina_id = 3) ---
-- Rossi Umbria
(18, 'Montefalco Sagrantino',           'DOCG','rosso',    3, 3, 2019, 15.5, 18, 20,  38.90, 27.70, 18.00,  27, TRUE),
(19, 'Montefalco Rosso',                'DOC', 'rosso',    3, 3, 2023, 13.5, 18, 20,  18.90, 13.50,  8.00,  13, TRUE),
-- Bianchi Umbria
(20, 'Trebbiano Spoletino',             'IGT', 'bianco',   3, 3, 2024, 13.5, 10, 11,  15.90, 11.30,  6.50,  11, TRUE),
(21, 'Grechetto Colli Perugini',        'DOC', 'bianco',   3, 3, 2024, 13.0,  8, 10,  12.90,  9.20,  5.00,   9, TRUE),
(22, 'Pinot Grigio Umbria',             'IGT', 'bianco',   3, 3, 2024, 12.5,  8, 10,  11.90,  8.50,  4.50,   8, TRUE),

-- --- VENETO (cantina_id = 4) ---
-- Rossi Veneto
(23, 'Valpolicella',                    'DOC', 'rosso',    4, 4, 2023, 12.5, 12, 14,  13.90,  9.90,  5.50,   9, TRUE),
(24, 'Valpolicella Ripasso Superiore',  'DOC', 'rosso',    4, 4, 2021, 14.5, 14, 16,  19.90, 14.20,  8.50,  14, TRUE),
(25, 'Amarone della Valpolicella',      'DOCG','rosso',    4, 4, 2019, 16.0, 16, 18,  54.90, 39.10, 26.00,  39, TRUE),
-- Bianchi Veneto (senza annata = non millésimé)
(26, 'Pinot Grigio delle Venezie',      'DOC', 'bianco',   4, 4, NULL, 12.5,  8, 10,  10.90,  7.80,  4.00,   7, TRUE),
(27, 'Soave',                           'DOC', 'bianco',   4, 4, NULL, 13.0,  8, 10,  10.90,  7.80,  4.00,   7, TRUE),
-- Spumanti Veneto (senza annata)
(28, 'Valdobbiadene Prosecco Sup. Brut',     'DOCG','spumante', 4, 4, NULL, 11.0,  6,  8,  15.90, 11.30,  6.50,  11, TRUE),
(29, 'Valdobbiadene Prosecco Sup. Extra Dry','DOCG','spumante', 4, 4, NULL, 11.5,  6,  8,  15.90, 11.30,  6.50,  11, TRUE),
(30, 'Prosecco Extra Dry',              'DOC', 'spumante', 4, 4, NULL, 11.0,  6,  8,  11.90,  8.50,  4.50,   8, TRUE);

SELECT setval('prodotti_id_seq', 30);

-- ---------------------------------------------------------------------------
-- Consulenti seed — albero dimostrativo (5 nodi, 3 livelli)
--
-- Struttura:
--   [1] Francesco Panzella (admin/top — sponsor_id NULL)
--       └─ [2] Giulia Mancini (L1 di Francesco)
--              └─ [3] Luca De Luca (L2 di Francesco, L1 di Giulia)
--                     └─ [4] Marta Esposito (L3 di Francesco, L1 di Luca)
--       └─ [5] Roberto Rinaldi (L1 di Francesco)
-- ---------------------------------------------------------------------------
INSERT INTO consulenti (
  id, nome, cognome, email, telefono, codice_fiscale,
  sponsor_id, status, status_max,
  pv_mese_corrente, gv_mese_corrente,
  attivo, formazione_completata,
  link_referral, stato_account, data_iscrizione
) VALUES
(1, 'Francesco', 'Panzella',   'fpanzella@invinus.it',   '+39 334 1000001', 'PNZFNC80A01F839X',
   NULL,  -- top of tree
   'DIRECTOR', 'DIRECTOR', 102.00, 52300.00,
   TRUE, TRUE, 'ref-fp001', 'attivo', '2025-01-10 09:00:00'),

(2, 'Giulia',    'Mancini',    'giulia.mancini@gmail.com',  '+39 347 2000002', 'MNCGLI90B42H501K',
   1, 'SUPERVISOR', 'SUPERVISOR', 68.00, 520.00,
   TRUE, TRUE, 'ref-gm002', 'attivo', '2025-02-15 10:30:00'),

(3, 'Luca',      'De Luca',    'luca.deluca@libero.it',     '+39 320 3000003', 'DLCLCU88C10A662M',
   2, 'ADVISOR', 'ADVISOR', 55.00, 160.00,
   TRUE, FALSE, 'ref-ld003', 'attivo', '2025-04-01 11:00:00'),

(4, 'Marta',     'Esposito',   'marta.esposito@yahoo.it',   '+39 366 4000004', 'SPSMRT95D50H501Z',
   3, 'APPRENTICE', 'APPRENTICE', 52.00, 55.00,
   TRUE, FALSE, 'ref-me004', 'attivo', '2025-07-20 14:00:00'),

(5, 'Roberto',   'Rinaldi',    'roberto.rinaldi@hotmail.it','+39 333 5000005', 'RNLRRT85E05F205V',
   1, 'STARTER', 'STARTER', 18.00, 0.00,
   FALSE, FALSE, 'ref-rr005', 'attivo', '2025-11-05 16:00:00');

SELECT setval('consulenti_id_seq', 5);

-- ---------------------------------------------------------------------------
-- Clienti seed — 4 clienti demo
-- ---------------------------------------------------------------------------
INSERT INTO clienti (
  id, nome, cognome, email, telefono,
  consulente_id, data_primo_acquisto, segmento,
  gdpr_consenso, gdpr_data_consenso
) VALUES
(1, 'Anna',    'Ferretti',  'anna.ferretti@gmail.com',   '+39 349 1111111', 2, '2025-05-10', 'wine_lover', TRUE, '2025-05-10'),
(2, 'Marco',   'Conti',     'marco.conti@azienda.it',    '+39 335 2222222', 2, '2025-08-22', 'horeca',     TRUE, '2025-08-22'),
(3, 'Sofia',   'Greco',     'sofia.greco@gmail.com',     '+39 347 3333333', 3, '2025-10-05', 'wine_lover', TRUE, '2025-10-05'),
(4, 'Davide',  'Serrano',   'davide.serrano@libero.it',  '+39 380 4444444', 4, '2025-12-15', 'wine_lover', TRUE, '2025-12-15');

SELECT setval('clienti_id_seq', 4);

-- ---------------------------------------------------------------------------
-- Box degustazione seed
-- ---------------------------------------------------------------------------
INSERT INTO box_degustazione (id, nome, descrizione, prezzo_pubblico, prezzo_consulente, pv_valore, attivo)
VALUES
(1, 'Starter Box Campania',
   'Selezione d''ingresso: 3 etichette campane per scoprire il Sannio.',
   39.90, 28.40, 28, TRUE),

(2, 'Box Rossi Eccellenti',
   'I rossi top del catalogo: Brunello, Amarone, Sagrantino. Perfetto per serate premium.',
   149.90, 106.70, 106, TRUE),

(3, 'Box Bollicine & Bianchi',
   'Prosecco + Falanghina + Vermentino: il kit ideale per aperitivi estivi.',
   44.90, 32.00, 32, TRUE);

SELECT setval('box_degustazione_id_seq', 3);

-- Contenuto box
INSERT INTO box_degustazione_righe (box_id, prodotto_id, quantita) VALUES
-- Starter Box Campania: Falanghina + Aglianico + Greco
(1, 4, 1),
(1, 2, 1),
(1, 5, 1),
-- Box Rossi Eccellenti: Brunello + Amarone + Sagrantino
(2, 11, 1),
(2, 25, 1),
(2, 18, 1),
-- Box Bollicine & Bianchi: Prosecco Valdobbiadene Brut + Falanghina + Vermentino
(3, 28, 1),
(3, 4,  1),
(3, 15, 1);


-- =============================================================================
-- NOTE IMPLEMENTATIVE
-- =============================================================================
-- 1. CALCOLO PV al pagamento: trigger su ordini.stato → 'pagato' aggiorna pv_generati
--    e propaga GV su tutta la catena upline (percorso ricorsivo su consulenti.sponsor_id)
--
-- 2. STATUS_MAX: trigger su consulenti.status → aggiorna status_max se nuovo status > max
--    (usa ordering enum PostgreSQL, es: 'ADVISOR' > 'STARTER' è TRUE)
--
-- 3. STOCK NEGATIVO: service magazzino.registraUscita() verifica
--    quantita_disponibile - quantita_riservata > 0 PRIMA di inserire il movimento
--
-- 4. BATCH MENSILE — ordine di esecuzione obbligatorio (doc 12 §9):
--    a) applicaStorni()        → storna PV da resi del mese
--    b) calcoloProvvigioni()   → consolida PV/GV netti
--    c) checkAttivita()        → determina chi è attivo (PV >= requisito status)
--    d) verificaPromozioni()   → promuove chi ha raggiunto soglia (irreversibile)
--    e) calcoloBonus()         → CAB + Bonus Car (richiede status aggiornati)
--    f) preparaPayout()        → applica soglia minima 10€ (doc 12 §6)
--
-- 5. GDPR art.17: cancellazione = anonimizzare nome/email/telefono/CF,
--    mantenere ID e dati aggregati per integrità contabile e albero genealogico
