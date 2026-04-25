# M4.1 — Progress Log: Schema registrazione cliente via invito

**Data:** 2026-04-25
**Milestone:** M4 (Registrazione sdoppiata) — FASE 1: Schema DB + RPC + RLS
**Stato:** ✅ Completata

---

## Cosa è stato fatto

### Schema DB (migration 005)
- **Enum `stato_cliente`:** `in_attesa_registrazione`, `attivo`, `sospeso`
- **Tabella `inviti_cliente`:** token UUID, scadenza 30gg, consumato flag, FK incaricato_id
- **Tabella `indirizzi_cliente`:** FK cliente_id, tipo (residenza/fatturazione/spedizione), predefinito, indirizzo fields, pec
- **Estensioni `clienti`:** `auth_user_id UUID`, `codice_fiscale VARCHAR(16) UNIQUE`, `data_nascita DATE`, `stato stato_cliente`
- **Constraint:** `clienti_email_unique`, `clienti_cf_required_if_attivo`, `clienti_data_nascita_required_if_attivo` (condizionali)
- **Trigger:** `trg_unico_predefinito_per_tipo` su `indirizzi_cliente` (enforce 1 default per tipo)

### RPC modificate
- **`crea_ordine_incaricato`:** modificata dual-mode — SE auth.uid() è incaricato → current; SE è cliente → lookup da `clienti.incaricato_id`; blocco sicurezza verifica appartenenza; `COALESCE(p_cliente_id, v_cliente_id)` per cliente che ordina senza specificare cliente_id

### RPC nuove (5)
- **`crea_invito_cliente`:** validation email regex, verifica unicita, crea record clienti + inviti_cliente, ritorna token UUID
- **`completa_registrazione_cliente`:** validazione token + eta 18+, usa `p_auth_user_id` passato come parametro (NO INSERT auth.users diretto), aggiorna clienti, consuma invito, inserisce 3 indirizzi
- **`rigenera_invito_cliente`:** invalidate vecchi inviti, genera nuovo token
- **`current_cliente_id`:** helper SQL SECURITY DEFINER
- **`valida_token_invito`:** RPC pubblica (anon+authenticated), ritorna validita + dati incaricato

### RLS Policy (13 nuove + column-level)
- `clienti`: `cli_select_own`, `cli_insert_by_incaricato`, `cli_update_own` (3)
- `inviti_cliente`: `invcli_insert`, `invcli_select`, `invcli_update` (3) + `admin_all` (1)
- `indirizzi_cliente`: `indcli_select`, `indcli_insert`, `indcli_update` (3) + `admin_all` (1)
- `ordini`: `ordcli_select` (1)
- **Column-level su `clienti`:** `REVOKE UPDATE FROM authenticated` + `GRANT UPDATE (nome, cognome, telefono) TO authenticated`

### File creati
- `db/migrations/005_clienti_registrazione_invito.sql`
- `docs/m4-piano.md`

---

## Decisioni progettuali
- Token invito: UUID v4 raw, lookup DB
- Record clienti: creato anticipato con stato `in_attesa_registrazione`
- Auth user creation: lato TS con `supabase.auth.admin.createUser()`, `auth_user_id` passato come parametro alla RPC
- Indirizzi: sempre 3 record (residenza obbligatoria, fatturazione+spedizione copiati se uguali)
- CHECK condizionali: CF/data_nascita NULL permessi per clienti demo (stato=`in_attesa_registrazione`)
- Autoconsumo: escluso da M4 (nessuna chiamata TS esistente)

---

## Verifiche eseguite
- Tabelle nuove: `inviti_cliente`, `indirizzi_cliente` — ✅
- Colonne `clienti`: `auth_user_id`, `codice_fiscale`, `data_nascita`, `stato` — ✅
- Constraint: `clienti_email_unique`, `clienti_cf_required_if_attivo`, `clienti_data_nascita_required_if_attivo` — ✅
- Enum `stato_cliente`: 3 valori — ✅
- RPC nuove: 5/5 presenti — ✅
- Body `crea_ordine_incaricato`: COALESCE + blocco sicurezza — ✅
- Policy count: clienti=7, inviti_cliente=4, indirizzi_cliente=4, ordini=4 — ✅
- 4 clienti demo: integri (stato=`in_attesa_registrazione`, CF/data_nascita=NULL) — ✅
- Ordini esistenti: 11 (invariati) — ✅

---

## Prossime fasi (M4.2-M4.5)
- **M4.2:** UI incaricato — "Aggiungi cliente" modal con form 4 campi
- **M4.3:** Pagina pubblica `/invito/[token]`
- **M4.4:** Layout `/cliente/*` + dashboard + profilo + ordini
- **M4.5:** Catalogo + carrello + checkout
