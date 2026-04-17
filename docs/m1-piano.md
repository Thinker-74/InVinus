# M1 — Piano di modifica (bozza da approvare)

> Generato dopo ispezione produzione. Non toccare file finché l'utente non approva.

---

## ⚠️ Discrepanze rispetto alle aspettative originali

Prima di leggere il piano, **4 sorprese** che cambiano i dettagli dell'esecuzione:

### S1 — `ruolo` è già ENUM (non VARCHAR)
Il task chiedeva di creare `CREATE TYPE ruolo_utente AS ENUM ('consulente', 'admin')` e convertire la
colonna da VARCHAR a ENUM. **In produzione la colonna è già ENUM** e il tipo si chiama `ruolo_consulente`
(non `ruolo_utente`). Valori: `consulente`, `admin`. Default: `'consulente'`.
→ Piano adattato: documentare `ruolo_consulente` in schema.sql, nessuna conversione necessaria in prod.

### S2 — 5 colonne extra su `consulenti` (non 2)
Oltre a `auth_user_id` e `ruolo`, in produzione esistono 4 colonne non documentate:
- `foto_url VARCHAR` (nullable)
- `bio VARCHAR` (nullable)
- `messaggio_referral VARCHAR` (nullable)
- `specialita VARCHAR` (nullable)

Queste alimentano la pagina `/referral/gestisci` e la funzione `aggiorna_profilo_consulente`.
→ Vanno aggiunte sia in schema.sql sia in migration 002.

### S3 — 12 funzioni in produzione non in schema.sql
Esistono in produzione funzioni mai documentate nel repo:
`aggiorna_profilo_consulente`, `aggiungi_cliente_consulente`, `candida_consulente`,
`get_admin_consulenti`, `get_admin_kpi`, `get_admin_top_consulenti`, `get_admin_trend`,
`get_clienti_consulente`, `get_consulente_by_referral`, `rls_auto_enable`,
`set_referral_code`, `set_vini_preferiti`.

I body di queste funzioni non sono recuperabili dalla sola query di ispezione. Includerle in
schema.sql richiederebbe eseguire `pg_get_functiondef()` per ciascuna.
→ **Fuori scope M1**: aggiungere in schema.sql solo un blocco commento che ne elenca l'esistenza.
→ Proposta per M1.5 separata: fetch dei body con `pg_get_functiondef` e aggiunte a schema.sql.

### S4 — `consulente_vini_preferiti` ha PK composita (nessun id)
La tabella ha 3 colonne: `consulente_id INT NOT NULL`, `prodotto_id INT NOT NULL`,
`ordine SMALLINT NOT NULL DEFAULT 0`. Nessuna colonna `id`. La PK è `(consulente_id, prodotto_id)`.

---

## A — Aggiunte a `db/schema.sql`

### A1 — Enum `ruolo_consulente` (nella sezione ENUM TYPES)
```sql
-- Ruolo utente per controllo accessi admin/consulente
CREATE TYPE ruolo_consulente AS ENUM ('consulente', 'admin');
```

### A2 — Enum `stato_candidatura` (nella sezione ENUM TYPES)
```sql
CREATE TYPE stato_candidatura AS ENUM ('in_attesa', 'approvata', 'rifiutata');
```

### A3 — 6 colonne aggiuntive su `consulenti` (dopo `created_at`, prima del CONSTRAINT)
```sql
  -- Collegamento a Supabase Auth (aggiunto ~2026-03 per autenticazione)
  auth_user_id              UUID UNIQUE,
  -- Profilo pubblico referral (aggiunto ~2026-03 per landing /ref/[code])
  foto_url                  VARCHAR(500),
  bio                       VARCHAR(1000),
  messaggio_referral        VARCHAR(500),
  specialita                VARCHAR(200),
  -- Ruolo per controllo accessi (aggiunto ~2026-03)
  ruolo                     ruolo_consulente NOT NULL DEFAULT 'consulente',
```

### A4 — Tabella `candidature` (nuova, dopo `consulenti`)
```sql
-- ---------------------------------------------------------------------------
-- Candidature — richieste di iscrizione come consulente (form /ref/[code])
-- Approvazione manuale admin → crea record in consulenti (no trigger automatico)
-- ---------------------------------------------------------------------------
CREATE TABLE candidature (
  id                    SERIAL PRIMARY KEY,
  nome                  VARCHAR(100) NOT NULL,
  cognome               VARCHAR(100) NOT NULL,
  email                 VARCHAR(200) NOT NULL,     -- senza UNIQUE: duplicati possibili
  telefono              VARCHAR(20),
  motivazione           TEXT,
  sponsor_referral_code VARCHAR(100) REFERENCES consulenti(link_referral) ON UPDATE CASCADE,
  stato                 stato_candidatura NOT NULL DEFAULT 'in_attesa',
  note_admin            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### A5 — Tabella `consulente_vini_preferiti` (nuova, dopo `candidature`)
```sql
-- ---------------------------------------------------------------------------
-- Vini preferiti consulente — selezione per landing referral personalizzata
-- PK composita: un consulente ha al massimo un record per vino
-- ---------------------------------------------------------------------------
CREATE TABLE consulente_vini_preferiti (
  consulente_id INT NOT NULL REFERENCES consulenti(id) ON DELETE CASCADE,
  prodotto_id   INT NOT NULL REFERENCES prodotti(id)   ON DELETE CASCADE,
  ordine        SMALLINT NOT NULL DEFAULT 0,             -- ordinamento visualizzazione
  PRIMARY KEY (consulente_id, prodotto_id)
);
```

### A6 — Indici nuovi (nella sezione INDICI)
```sql
-- Candidature
CREATE INDEX idx_candidature_stato   ON candidature(stato);
CREATE INDEX idx_candidature_email   ON candidature(email);

-- Consulente vini preferiti
CREATE INDEX idx_vini_pref_consulente ON consulente_vini_preferiti(consulente_id);

-- Consulenti — ricerca per auth_user_id (usata da proxy e dashboard ad ogni request)
CREATE INDEX idx_consulenti_auth_user ON consulenti(auth_user_id);
```

### A7 — Commento funzioni non documentate (in fondo a schema.sql, prima delle NOTE IMPLEMENTATIVE)
```sql
-- =============================================================================
-- FUNZIONI CUSTOM IN PRODUZIONE (body non incluso in questo file — vedi M1.5)
-- =============================================================================
-- Le seguenti funzioni esistono su Supabase ma i loro body non sono inclusi
-- in schema.sql. Documentate qui per inventario; recuperare con pg_get_functiondef
-- per completare la documentazione (task M1.5).
--
-- Funzioni presenti al 2026-04-17:
--   aggiorna_profilo_consulente(p_bio, p_messaggio_referral, p_specialita, p_foto_url)
--   aggiungi_cliente_consulente(p_nome, p_cognome, p_email, p_telefono)
--   candida_consulente(p_nome, p_cognome, p_email, p_telefono, p_motivazione, p_referral_code)
--   crea_ordine_consulente(p_cliente_id, p_tipo, p_righe)  ← body in 001_security_fixes.sql
--   get_admin_consulenti(p_anno, p_mese)
--   get_admin_kpi(p_anno, p_mese)
--   get_admin_top_consulenti(p_anno, p_mese, p_limit)
--   get_admin_trend(p_mesi)
--   get_clienti_consulente(p_consulente_id)
--   get_consulente_by_referral(p_code)
--   get_dashboard_consulente(p_consulente_id, p_anno, p_mese) ← body in 001_security_fixes.sql
--   get_team_consulente(p_consulente_id, p_anno, p_mese) ← body in 001_security_fixes.sql
--   rls_auto_enable()   ← utility interna Supabase
--   set_referral_code(p_code)
--   set_vini_preferiti(p_prodotto_ids)
-- =============================================================================
```

---

## B — Contenuto `db/migrations/002_sync_schema.sql`

```sql
-- =============================================================================
-- Migrazione 002 — Sincronizzazione schema.sql con stato reale di produzione
-- Data: 2026-04-17
--
-- Contesto: questa migration sincronizza db/schema.sql con le modifiche applicate
-- manualmente su Supabase durante le sessioni di sviluppo 2026-02/03, prima che
-- venisse formalizzato il workflow "migration-first" (vedi CLAUDE.md).
--
-- Idempotente: può essere rieseguita su produzione senza errori (IF NOT EXISTS,
-- blocchi DO $$ con EXCEPTION WHEN duplicate_object).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Enum stato_candidatura
--    Aggiunto manualmente ~2026-02 per la tabella candidature.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE stato_candidatura AS ENUM ('in_attesa', 'approvata', 'rifiutata');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- 2. Enum ruolo_consulente
--    Aggiunto manualmente ~2026-03 per il sistema di ruoli admin/consulente.
--    Nome produzione: ruolo_consulente (non ruolo_utente).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE ruolo_consulente AS ENUM ('consulente', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- 3. Tabella candidature
--    Creata manualmente ~2026-02 per il form di candidatura /ref/[code].
--    Le RLS policy (insert_public, select_authenticated) sono gestite da
--    migration 001_security_fixes.sql.
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
--    PK composita: un consulente ha al massimo un record per vino.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consulente_vini_preferiti (
  consulente_id INT NOT NULL REFERENCES consulenti(id) ON DELETE CASCADE,
  prodotto_id   INT NOT NULL REFERENCES prodotti(id)   ON DELETE CASCADE,
  ordine        SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (consulente_id, prodotto_id)
);


-- ---------------------------------------------------------------------------
-- 5. Colonne aggiuntive su consulenti
--    Aggiunte manualmente ~2026-03 per auth Supabase e profilo referral.
-- ---------------------------------------------------------------------------

-- auth_user_id: collega il consulente all'utente Supabase Auth (auth.users.id)
ALTER TABLE consulenti ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- Profilo pubblico per la landing personalizzata /ref/[code]
ALTER TABLE consulenti ADD COLUMN IF NOT EXISTS foto_url           VARCHAR(500);
ALTER TABLE consulenti ADD COLUMN IF NOT EXISTS bio                VARCHAR(1000);
ALTER TABLE consulenti ADD COLUMN IF NOT EXISTS messaggio_referral VARCHAR(500);
ALTER TABLE consulenti ADD COLUMN IF NOT EXISTS specialita         VARCHAR(200);

-- ruolo: enum ruolo_consulente per il controllo accessi /admin/*
-- Blocco DO: gestisce idempotenza indipendentemente dal tipo attuale della colonna.
DO $$
BEGIN
  -- Caso 1: colonna assente → aggiungila
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'consulenti'
      AND column_name  = 'ruolo'
  ) THEN
    ALTER TABLE consulenti
      ADD COLUMN ruolo ruolo_consulente NOT NULL DEFAULT 'consulente';

  -- Caso 2: colonna presente come character varying → converti a enum
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'consulenti'
      AND column_name  = 'ruolo'
      AND data_type    = 'character varying'
  ) THEN
    -- Normalizza valori anomali prima della conversione
    UPDATE consulenti SET ruolo = 'consulente'
      WHERE ruolo IS NULL OR ruolo NOT IN ('consulente', 'admin');
    ALTER TABLE consulenti
      ALTER COLUMN ruolo TYPE ruolo_consulente
        USING ruolo::ruolo_consulente,
      ALTER COLUMN ruolo SET NOT NULL,
      ALTER COLUMN ruolo SET DEFAULT 'consulente';

  -- Caso 3: colonna già di tipo ruolo_consulente → nessuna azione
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 6. Indici nuovi
-- ---------------------------------------------------------------------------

-- Ricerca auth_user_id usata ad ogni request da proxy.ts e dashboard
CREATE INDEX IF NOT EXISTS idx_consulenti_auth_user   ON consulenti(auth_user_id);

-- Filtri candidature per stato (pagina admin)
CREATE INDEX IF NOT EXISTS idx_candidature_stato       ON candidature(stato);
CREATE INDEX IF NOT EXISTS idx_candidature_email       ON candidature(email);

-- Vini preferiti per consulente
CREATE INDEX IF NOT EXISTS idx_vini_pref_consulente    ON consulente_vini_preferiti(consulente_id);
```

---

## C — Modifica `web/next.config.ts` (fix warning outputFileTracingRoot)

**Causa:** `turbopack.root` è impostato esplicitamente a `path.resolve(__dirname)` (che è la stessa
directory `web/`, il default implicito di Next.js). Next.js 16 auto-computa anche `outputFileTracingRoot`
internamente; quando trova `turbopack.root` impostato esplicitamente, genera il warning di conflitto.

**Fix:** rimuovere il blocco `turbopack` (ridondante) e l'import `path` non più usato.

```ts
// PRIMA:
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  ...(process.env.NODE_ENV === "development" && {
    allowedDevOrigins: ["192.168.1.63"],
  }),
};

export default nextConfig;

// DOPO:
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === "development" && {
    allowedDevOrigins: ["192.168.1.63"],
  }),
};

export default nextConfig;
```

---

## D — Aggiornamento `CLAUDE.md` del progetto

Aggiungere dopo la sezione "Ordine di lettura consigliato per iniziare":

```markdown
## Governance schema DB

`db/schema.sql` è la **source of truth** dello schema PostgreSQL.
Workflow obbligatorio per ogni modifica al DB:

1. Scrivi la migration in `db/migrations/NNN_descrizione.sql` (idempotente: IF NOT EXISTS, ecc.)
2. Applica la migration su produzione (Supabase SQL Editor)
3. Aggiorna `db/schema.sql` per riflettere il nuovo stato
4. Rigenera i tipi TypeScript: `supabase gen types typescript --linked 2>&1 | tail -n +2 > web/src/types/supabase.ts`
5. Commit tutto insieme: migration + schema.sql + tipi aggiornati
```

---

## E — Cosa NON è incluso in M1

| Item | Motivazione |
|------|-------------|
| Body delle 12+ funzioni custom | Richiedono `pg_get_functiondef()` — task separato M1.5 |
| RLS policy nuove o modificate | Scope M2 |
| Tipi TypeScript rigenerati | Da eseguire dall'utente dopo exec migration in prod |
| Seed data per `candidature` e `consulente_vini_preferiti` | Non necessari — tabelle già popolate in prod |

---

## Riepilogo file toccati (dopo approvazione)

| File | Azione |
|------|--------|
| `db/schema.sql` | Aggiunta enum, colonne, tabelle, indici, commento funzioni |
| `db/migrations/002_sync_schema.sql` | Creazione (nuovo file) |
| `web/next.config.ts` | Rimozione `turbopack.root` e import `path` |
| `CLAUDE.md` | Aggiunta sezione governance schema DB |
| `docs/m1-verifica.md` | Creazione checklist pre-commit (Fase 4) |
