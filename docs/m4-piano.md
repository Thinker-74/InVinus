# M4 — Piano implementativo: Registrazione sdoppiata + area cliente

**Stato:** Piano redatto (2026-04-25), in attesa approvazione Michele
**Milestone precedente:** M3 sospesa (in attesa 5 decisioni UX Francesco)
**Milestone successiva:** M5 (KYC + tesserino L.173/2005)

---

## Decisioni progettuali già concordate (2026-04-24)

| # | Questione | Decisione |
|---|-----------|-----------|
| Q1 | Token invite | UUID v4 raw, lookup DB per validazione |
| Q2 | Record clienti | Creato subito con stato `in_attesa_registrazione` |
| Q3 | Indirizzi | Tabella `indirizzi_cliente` separata (FK cliente_id, tipo, predefinito) |
| Q4 | Dashboard cliente | Route `/cliente/*` separata, layout dedicato |
| Q5 | RPC `crea_ordine` | Modifica body `crea_ordine_incaricato` dual-mode (no rename). Chiamante: se incaricato → current; se cliente → lookup da clienti.incaricato_id |

**Modello cliente L.173/2005 (vincolo legale):**
- Sempre persona fisica, MAI partita IVA
- Codice fiscale obbligatorio (UNIQUE, NOT NULL)
- Data nascita obbligatoria (verifica >= 18 anni)
- Email = login (UNIQUE)

**Escluso da M4:** Invita un amico, nurturing, promo, Stripe LIVE, MailerSend, fattura SDI (rimandati post-decisione Francesco)

---

## Riepilogo scope

```
Migration 005:        +2 tabelle (inviti_cliente, indirizzi_cliente)
                       +1 enum (stato_cliente)
                       +1 constraint email_unique su clienti
                       +5 colonne clienti (auth_user_id, codice_fiscale, data_nascita,
                                         stato, token_invito_scadenza)
                       +2 CHECK constraint (cf/data_nascita required if attivo)
                       +1 modifica body (crea_ordine_incaricato dual-mode, no rename)
                       +5 RPC nuove (crea_invito_cliente, completa_registrazione_cliente,
                                     current_cliente_id, rigenera_invito_cliente, valida_token_invito)
                       +6+ RLS policy nuove + column-level REVOKE/GRANT su clienti

UI (app)incaricato:    ~2 file modificati (clienti page, actions)
UI (app)cliente:       ~10 file nuovi (layout, dashboard, profilo, ordini, nuovo-ordine)
UI pubblica:           ~2 file nuovi (/invito/[token], /cliente/nuovo-ordine)

Test end-to-end:       Smoke test: incaricato pre-registra → link console →
                       cliente completa → ordine test →admin/ordini
```

---

## FASE 1 — Schema + Migration 005

### 1.1 Enum `stato_cliente`

```sql
CREATE TYPE stato_cliente AS ENUM ('in_attesa_registrazione', 'attivo', 'sospeso');
```

### 1.2 Nuove tabelle

**`inviti_cliente`**
```sql
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
-- PK composita: NON creare, UNIQUE email+incaricato già basta
```

**`indirizzi_cliente`**
```sql
CREATE TABLE indirizzi_cliente (
  id             SERIAL PRIMARY KEY,
  cliente_id     INT NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
  tipo           VARCHAR(20) NOT NULL CHECK (tipo IN ('residenza', 'fatturazione', 'spedizione')),
  predefinito    BOOLEAN NOT NULL DEFAULT FALSE,
  nome_via       VARCHAR(200),
  numero_civico  VARCHAR(20),
  cap            VARCHAR(10),
  città          VARCHAR(100),
  provincia      VARCHAR(2),
  nazione        VARCHAR(2) NOT NULL DEFAULT 'IT',
  pec            VARCHAR(200),                              -- nullable, solo fatturazione
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cliente_id, tipo, predefinito)  -- solo 1 predefinito per tipo
);
```

### 1.3 Estensioni `clienti`

```sql
-- email unica (verificato: 4 clienti demo hanno email distinte non-NULL)
ALTER TABLE clienti ADD CONSTRAINT clienti_email_unique UNIQUE (email);
ALTER TABLE clienti ADD COLUMN auth_user_id UUID UNIQUE;
ALTER TABLE clienti ADD COLUMN codice_fiscale VARCHAR(16) UNIQUE;  -- nullable, CHECK se attivo
ALTER TABLE clienti ADD COLUMN data_nascita DATE;                    -- nullable, CHECK se attivo
ALTER TABLE clienti ADD COLUMN stato stato_cliente NOT NULL DEFAULT 'in_attesa_registrazione';
-- CHECK: CF e data_nascita obbligatori per cliente 'attivo' (non per demo in attesa)
ALTER TABLE clienti ADD CONSTRAINT clienti_cf_required_if_attivo CHECK (
  stato = 'in_attesa_registrazione' OR codice_fiscale IS NOT NULL
);
ALTER TABLE clienti ADD CONSTRAINT clienti_data_nascita_required_if_attivo CHECK (
  stato = 'in_attesa_registrazione' OR data_nascita IS NOT NULL
);
```
ALTER TABLE clienti ADD COLUMN stato stato_cliente NOT NULL DEFAULT 'in_attesa_registrazione';
ALTER TABLE clienti ADD COLUMN token_invito_scadenza TIMESTAMPTZ;
-- CHECK: CF e data_nascita obbligatori per cliente 'attivo' (non per demo in attesa)
ALTER TABLE clienti ADD CONSTRAINT clienti_cf_required_if_attivo CHECK (
  stato = 'in_attesa_registrazione' OR codice_fiscale IS NOT NULL
);
ALTER TABLE clienti ADD CONSTRAINT clienti_data_nascita_required_if_attivo CHECK (
  stato = 'in_attesa_registrazione' OR data_nascita IS NOT NULL
);
```

### 1.4 Modifica body `crea_ordine_incaricato` — dual-mode

**No rename.** Il nome resta `crea_ordine_incaricato`. Modificato solo il body per supportare chiamata da cliente autenticato:

```sql
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
```

**Autoconsumo escluso da M4** — il flusso `p_cliente_id = NULL` non è invocato dal codice TS attuale. Feature rimandata.

### 1.5 RPC nuove

**`crea_invito_cliente`** — SECURITY DEFINER
```sql
-- Input: p_nome, p_cognome, p_email, p_telefono
-- Output: token UUID (da loggare / inviare via email)
-- Comportamento:
--   1. Validazione formato email
--   2. Verifica che non esista già cliente con quella email (UNIQUE)
--   3. Verifica che l'incaricato non abbia già un invito pendente per quella email
--   4. Crea record clienti (stato='in_attesa_registrazione', no auth_user_id)
--   5. Crea record inviti_cliente (token, scadenza 30gg)
--   6. Restituisce token
```

**`completa_registrazione_cliente`** — SECURITY DEFINER
```sql
-- NOTE: Flusso corretto prevede creazione auth user lato client TS con
--   supabase.auth.admin.createUser({ email, password }) PRIMA di chiamare questa RPC.
--   L'auth_user_id viene passato come parametro p_auth_user_id.
-- Input: p_token, p_auth_user_id, p_data_nascita, p_codice_fiscale,
--        indirizzo_residenza (campi), p_fatturazione_uguale (bool),
--        indirizzi fatturazione/spedizione (opt)
-- Output: cliente_id
-- Comportamento:
--   1. Valida token (esiste, non scaduto, non consumato)
--   2. Verifica età >= 18 (data_nascita vs NOW())
--   3. Aggiorna clienti: auth_user_id (= gia creato esternamente), codice_fiscale,
--      data_nascita, stato='attivo'
--   4. Segna invito come consumato
--   5. Inserisci 3 record indirizzi (residenza obbligatoria,
--      fatturazione+spedizione se diverse, altrimenti copia da residenza)
--   6. Return cliente_id
```

**`current_cliente_id`** — SECURITY DEFINER
```sql
-- Input: none (usa auth.uid())
-- Output: cliente_id INT o NULL
-- Comportamento: SELECT id FROM clienti WHERE auth_user_id = auth.uid()
```

**`rigenera_invito_cliente`** — SECURITY DEFINER
```sql
-- Input: p_cliente_id
-- Output: nuovo token UUID
-- Comportamento:
--   1. Verifica che il cliente appartenga all'incaricato corrente (incaricato_id = current)
--   2. Verifica stato cliente = 'in_attesa_registrazione'
--   3. Aggiorna token con nuovo UUID, nuova scadenza 30gg
--   4. Reset consumato=FALSE
--   5. Return nuovo token
```

### 1.6 RLS nuove policy + column-level security su `clienti`

**Tabella `clienti`:**
- `cli_select_own`: authenticated, SELECT, USING `(auth_user_id = auth.uid())`
- `cli_insert_by_incaricato`: authenticated, INSERT, WITH CHECK `(incaricato_id = current_incaricato_id())`
- `cli_update_own`: authenticated, UPDATE, USING `(auth_user_id = auth.uid())`, WITH CHECK `(auth_user_id = auth.uid())`

**Column-level REVOKE/GRANT su `clienti` (stesso pattern M2 su `incaricati`):**
```sql
REVOKE UPDATE ON clienti FROM authenticated;
GRANT UPDATE (nome, cognome, telefono) ON clienti TO authenticated;
```
Colonne modificabili dal cliente: `nome, cognome, telefono`
Colonne IMMUTABILI: `codice_fiscale, data_nascita, email, stato, incaricato_id, auth_user_id`

**Tabella `inviti_cliente`:**
- `invcli_insert`: authenticated, INSERT, WITH CHECK `(incaricato_id = current_incaricato_id())`
- `invcli_select`: authenticated, SELECT, USING `(incaricato_id = current_incaricato_id())`
- `invcli_update`: authenticated, UPDATE, USING `(incaricato_id = current_incaricato_id())`, WITH CHECK `(incaricato_id = current_incaricato_id())`

**Tabella `indirizzi_cliente`:**
- `indcli_select`: authenticated, SELECT, USING `(cliente_id IN (SELECT id FROM clienti WHERE auth_user_id = auth.uid()))`
- `indcli_insert`: authenticated, INSERT, WITH CHECK `(cliente_id IN (SELECT id FROM clienti WHERE auth_user_id = auth.uid()))`
- `indcli_update`: authenticated, UPDATE, USING `(cliente_id IN (SELECT id FROM clienti WHERE auth_user_id = auth.uid()))`, WITH CHECK `(cliente_id IN (SELECT id FROM clienti WHERE auth_user_id = auth.uid()))`

**Tabella `ordini` (cliente vede i propri ordini —Policy preesistente `ordcli_select` già copre):**
- `ordcli_select`: authenticated, SELECT, USING `(cliente_id IN (SELECT id FROM clienti WHERE auth_user_id = auth.uid()))`

**Admin:** `admin_all` copre tutte le tabelle nuove (verificato in M2).

### 1.7 Constraint unica su indirizzi_cliente

```sql
-- Solo 1 indirizzo predefinito per tipo per cliente
UNIQUE(cliente_id, tipo, predefinito) → richiede Constraint parziale (non standard PostgreSQL)
-- workaround: trigger CHECK che prima di INSERT/UPDATE su indirizzi_cliente,
--   se predefinito=TRUE → SET predefinito=FALSE su tutti gli altri dello stesso tipo
```

---

## FASE 2 — UI incaricato "Aggiungi cliente"

### 2.1 Percorso

`web/src/app/(app)/clienti/page.tsx` — modificato
`web/src/app/(app)/clienti/AggiungiClienteClient.tsx` — nuovo (modal)

### 2.2 Comportamento

- Pulsante "+ Nuovo cliente" in cima alla lista
- Modal con 4 campi: nome, cognome, email, telefono
- Submit → Server Action → RPC `crea_invito_cliente`
- Risposta: mostra "Invito inviato a [email]" + token/log del link (DRY-RUN)
- Lista clienti: colonna stato "in_attesa_registrazione" badge giallo + pulsante "Rinvia invito"

---

## FASE 3 — Pagina pubblica `/invito/[token]`

### 3.1 Percorso

`web/src/app/invito/[token]/page.tsx` — nuovo (Server Component)
`web/src/app/invito/[token]/CompletaRegistrazioneClient.tsx` — nuovo

### 3.2 Comportamento

- Validazione token lato server (RPC helper `validata_invito_token`)
- Form completo registrazione: password + conferma, data nascita, codice fiscale
- Se checkbox "fatturazione/spedizione uguali a residenza" DISATTIVA (default ON):
  - Residenza: nome_via, numero_civico, cap, città, provincia (campi extraappaiono se unchecked)
- Submit → `completa_registrazione_cliente`
- Post-success: auto-login (Supabase auth) + redirect `/cliente/dashboard`

---

## FASE 4 — Layout e dashboard cliente `/cliente/*`

### 4.1 Percorso

```
web/src/app/cliente/
  layout.tsx                    — header brand + nav (Profilo / Storico ordini / Nuovo ordine)
  dashboard/page.tsx            — greeting + 3 card (ultimo ordine, prossima consegna, suggerimenti)
  profilo/page.tsx             — dati anagrafici + indirizzi (modificabili)
  ordini/page.tsx              — lista storico ordini
  ordini/[id]/page.tsx         — dettaglio ordine
  nuovo-ordine/page.tsx        — catalogo + carrello + checkout
```

### 4.2 Layout cliente

- Header con logo InVinus (link a `/`) + "Benvenuto [nome]"
- Nav: Profilo | I miei ordini | Nuovo ordine
- Nessun bleed con layout `(app)` — routes separati

### 4.3 Dashboard cliente

- Greeting personalizzato
- Card 1: ultimo ordine (data, totale, stato)
- Card 2: prossima consegna (se ordine in stato spedito/consegnato)
- Card 3: suggerimenti basati su storico ordini (top 3 prodotti più ordinati)

### 4.4 Profilo cliente

- Dati anagrafici (sola lettura tranne telefono): nome, cognome, email, CF, data nascita
- Sezione indirizzi: lista con edit inline (modifica indirizzo predefinito)
- Pulsante "Modifica" per ogni indirizzo (modal con form)

### 4.5 Storico ordini cliente `/cliente/ordini`

- Lista: data, totale, stato badge colorato, num prodotti
- Filtri: periodo (mese/anno), stato
- Click → `/cliente/ordini/[id]`

### 4.6 Dettaglio ordine `/cliente/ordini/[id]`

- Dati ordine: data, stato, metodo pagamento, totale
- Lista righe: prodotto (foto+nome), quantita, prezzo unitario, subtotale
- Indirizzo spedizione

---

## FASE 5 — Catalogo + carrello + checkout cliente

### 5.1 Percorso

```
web/src/app/cliente/nuovo-ordine/
  page.tsx          — layout pagina (Server Component, fetch prodotti)
  CatalogoClient.tsx — filtri + grid prodotti + carrello drawer
  CheckoutClient.tsx — Riepilogo ordine + selezione pagamento
```

### 5.2 Catalogo

- Filtri: regione, tipo (rosso/bianco/rosato/spumante), range prezzo
- Card prodotto: immagine, nome, cantina, prezzo, bottone "Aggiungi al carrello"
- Carrello: drawer slide-in React state (no persistenza DB, in-memory)
- Count badge carrello nella nav

### 5.3 Checkout

- Riepilogo ordine (lista righe, subtotale, totale)
- Scelta pagamento:
  - Stripe Card (test mode) → redirect a Stripe Checkout
  - Satispay (test mode se API consentono, altrimenti placeholder)
  - Bonifico → mostra IBAN aziendale + stato "in_attesa_bonifico"
- Submit → RPC `crea_ordine` con `p_tipo='vendita_cliente'`
- Stripe: redirect post-pagamento a `/cliente/ordini/[id]`
- Bonifico: redirect a `/cliente/ordini/[id]` con stato "in_attesa_bonifico"

---

## FASE 6 — Edge cases

### 6.1 Campi immutabili post-registrazione

- `codice_fiscale`, `data_nascita` NON modificabili dopo registrazione (bloccati da RLS collevel + UI readonly)
- `incaricato_id` immutabile post-registrazione (sponsor fisso)

### 6.2 Incaricato sospeso

- Clienti dell'incaricato sospeso possono ancora ordinare
- PV attribuiti all'incaricato sospeso (nessuna provvigione generata sul suo account)
- **Decisione di prodotto:** provvigioni dei clienti di incaricato sospeso vanno a InVinus o a zero? → **M4 default: zero, segnalare a Francesco**

### 6.3 Indirizzo predefinito

- Trigger DB: se si imposta `predefinito=TRUE` per un tipo, gli altri dello stesso tipo per lo stesso cliente vengono impostati `predefinito=FALSE`

### 6.4 Verifica età

- Lato server in `completa_registrazione_cliente`: `IF age(data_nascita) < 18 years THEN RAISE EXCEPTION 'Devi avere almeno 18 anni'`

---

## FASE 7 — Test e verifica

### Smoke test end-to-end

```
1. Login come Francesco (incaricato admin)
2. Vai su /clienti → "+ Nuovo cliente"
3. Inserisci: Mario Rossi, m.rossi@test.it, +39 333
4. Click "Invia invito" → ottieni token (log console Vercel)
5. Copia URL: https://invinus.vercel.app/invito/[token]
6. Apri in altra finestra incognita
7. Compila form: password, 2000-01-01, MRTMRA80A01F839T, indirizzo
8. Submit → auto-login → redirect /cliente/dashboard
9. Vai su /cliente/nuovo-ordine → aggiungi 1 prodotto al carrello
10. Checkout bonifico → submit → ordine creato
11. Verifica: /admin/ordini mostra ordine di Mario Rossi (stato "in_attesa_bonifico")
```

### Checklist verifiche

- [ ] Token UUID valido → form registra, consumato=TRUE dopo registrazione
- [ ] Età < 18 → errore "Devi avere almeno 18 anni"
- [ ] CF duplicato → errore "Codice fiscale già registrato"
- [ ] Indirizzo residenza obbligatorio → validazione server
- [ ] Checkbox "uguali a residenza" → crea 3 record indirizzi se DISATTIVO
- [ ] Cliente non può modificare CF/data_nascita → RLS blocca
- [ ] Incaricato vede clienti propri → RLS + RPC
- [ ] Rinvia invito → nuovo token generato, vecchio invalido

---

## Stima SQL (statement count)

| Elemento | Count |
|----------|-------|
| CREATE TYPE (stato_cliente) | 1 |
| CREATE TABLE inviti_cliente | 1 |
| CREATE TABLE indirizzi_cliente | 1 |
| ALTER TABLE clienti (5 colonne) | 5 |
| ALTER FUNCTION RENAME | 1 |
| CREATE alias Function | 1 |
| CREATE FUNCTION RPC (4 nuove) | 4 |
| CREATE TRIGGER (indirizzo predefinito) | 1 |
| CREATE INDEX (su nuove tabelle) | ~4 |
| CREATE POLICY (RLS, ~10 policy) | ~10 |
| **Total** | **~29 statements** |

## Stima File TS modificati/creati

| Fase | File | Azione |
|------|------|--------|
| F1 | `web/src/types/supabase.ts` | Rigenerato post-migration |
| F2 | `(app)/clienti/page.tsx` | Modificato (+pulsante) |
| F2 | `(app)/clienti/AggiungiClienteClient.tsx` | Nuovo |
| F2 | `(app)/clienti/actions.ts` | Modificato (+RPC calls) |
| F3 | `invito/[token]/page.tsx` | Nuovo |
| F3 | `invito/[token]/CompletaRegistrazioneClient.tsx` | Nuovo |
| F4 | `cliente/layout.tsx` | Nuovo |
| F4 | `cliente/dashboard/page.tsx` | Nuovo |
| F4 | `cliente/profilo/page.tsx` | Nuovo |
| F4 | `cliente/ordini/page.tsx` | Nuovo |
| F4 | `cliente/ordini/[id]/page.tsx` | Nuovo |
| F4 | `cliente/nuovo-ordine/page.tsx` | Nuovo |
| F4 | `cliente/nuovo-ordine/CatalogoClient.tsx` | Nuovo |
| F4 | `cliente/nuovo-ordine/CheckoutClient.tsx` | Nuovo |
| F5 | `web/src/lib/supabase/client.ts` | Verificato (auth helper per cliente) |
| F6 | `web/src/app/admin/ordini/page.tsx` | Verificato (ordini clienti visibili ad admin) |
| **Total** | **~17 file** |

---

## Dipendenze e precedenze

```
FASE 1 (Schema) → FASE 2 (UI incaricato)
                          ↘ FASE 3 (invito pubblico)
FASE 3 success → FASE 4 (layout cliente)
                          ↘ FASE 5 (catalogo+checkout)
FASE 5 success → FASE 7 (smoke test)
```

**Fase 1 obbligatoria prima di qualsiasi altra** (senza schema le RPC non esistono).

---

## TODO M4.5 — Prossimi miglioramenti (post M4)

**Mostrare invitante in profilo cliente:**
- Policy SELECT su `inviti_cliente` per cliente proprietario (via email lookup: cliente.email = inviti_cliente.cliente_email)
- UI in `/cliente/profilo`: "Sei stato invitato da [Nome Incaricato] [Cognome]"
- Implementazione: RPC `get_invitato_da(cliente_email)` che join inviti_cliente+incaricati e ritorna nome/cognome

---

## Nota su Stripe test mode

- Michele creerà chiavi Stripe test proprie
- Env var: `STRIPE_TEST_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY`
- Switch live/test via `NEXT_PUBLIC_STRIPE_MODE=test|live`
- Nessun codice Stripe toccato in FASE 1-4 (solo placeholder接线 in FASE 5)
