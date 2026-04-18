# M2 — RLS policy granulari (migration 004)

> Stato: PIANIFICATO — approvazione utente richiesta prima di FASE 3 (scrittura file migration)
> Ultima revisione: 2026-04-18 (dopo ISSUE 1-5)

---

## Obiettivo

Sostituire le policy permissive esistenti (SELECT authenticated USING true) con policy
granulari per tre livelli: anon / incaricato (solo propri dati) / admin (tutto).

---

## Ordine di esecuzione migration 004

1. ALTER TABLE incaricati — aggiungi candidatura_id
2. CREATE FUNCTION current_incaricato_id()
3. CREATE FUNCTION current_is_admin()
4. CREATE FUNCTION get_my_profile()
5. REVOKE/GRANT column-level su incaricati
6. Policy per tabella (ordine: incaricati → dati personali → transazionali → reference → admin-only)
7. Storage: fix bucket profili

---

## §1 — Schema change: candidatura_id su incaricati

```sql
ALTER TABLE incaricati ADD COLUMN candidatura_id INT REFERENCES candidature(id);
CREATE INDEX idx_incaricati_candidatura ON incaricati(candidatura_id);
```

---

## §2 — Funzioni helper

```sql
-- Restituisce incaricati.id dell'utente corrente. NULL se non mappato.
CREATE OR REPLACE FUNCTION current_incaricato_id()
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM incaricati WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- True se l'utente corrente ha ruolo 'admin'.
CREATE OR REPLACE FUNCTION current_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM incaricati
    WHERE auth_user_id = auth.uid() AND ruolo = 'admin'
  )
$$;

-- Restituisce il profilo completo (tutti i campi) del proprio incaricato.
-- Usata dalle pagine profilo personale per accedere ai campi in REVOKE (email, ecc.).
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS SETOF incaricati LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM incaricati WHERE auth_user_id = auth.uid() LIMIT 1
$$;
```

---

## §3 — Column-level privileges su incaricati

Colonne verificate contro information_schema (27 colonne totali in produzione).
Nessuna colonna non classificata.

```sql
-- Prima: revoca il grant tabella-livello (PostgREST lo aveva come SELECT su tutto)
REVOKE SELECT ON TABLE incaricati FROM authenticated;

-- Colonne sensibili: accessibili solo via get_my_profile() (proprietario) o admin
-- REVOKE (7): email, telefono, codice_fiscale, stripe_account_id,
--             data_ultimo_status_change, approvato_da, approvato_il

-- Colonne pubbliche: visibili a tutti gli incaricati autenticati via SELECT diretto
GRANT SELECT (
  id, nome, cognome,
  sponsor_id, status, status_max, ruolo,
  pv_mese_corrente, gv_mese_corrente,
  attivo, formazione_completata,
  link_referral, stato_account,
  data_iscrizione, created_at,
  auth_user_id,
  foto_url, bio, messaggio_referral, specialita,
  candidatura_id
) ON TABLE incaricati TO authenticated;
```

> NOTA: il REVOKE esplicito delle 7 colonne non è necessario se si fa REVOKE ALL + GRANT selettivo.
> Il pattern sopra (REVOKE tutto → GRANT selettivo) è sufficiente e più robusto.
> Le 7 colonne escluse dal GRANT sono implicitamente negate.

---

## §4 — Policy per tabella

### Pattern generale

Due policy PERMISSIVE per tabella (si OR-ano):
- `inc_*`: predicato su `incaricato_id = current_incaricato_id()` (o equivalente)
- `admin_all`: `current_is_admin()` — FOR ALL, copre ogni comando

---

### A — DATI PERSONALI INCARICATO

#### `incaricati`

```sql
DROP POLICY IF EXISTS "incaricati_read" ON incaricati;

-- SELECT aperto (necessario per JOIN: dashboard mostra sponsor, albero team, ecc.)
-- I campi sensibili sono già protetti a livello column-level (§3)
CREATE POLICY "inc_select_all" ON incaricati FOR SELECT TO authenticated
  USING (true);

-- UPDATE solo su sé stesso
CREATE POLICY "inc_update_own" ON incaricati FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Admin: tutto
CREATE POLICY "admin_all" ON incaricati FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```

> anon: nessuna policy SELECT → bloccato
> INSERT incaricato: bloccato (creato da admin o via flusso candidatura)
> DELETE incaricato: bloccato (solo admin via admin_all)
> Campi sensibili (email, CF, ecc.) protetti da column-level REVOKE (§3), non da RLS

#### `incaricato_vini_preferiti`

```sql
DROP POLICY IF EXISTS "select_all_authenticated" ON incaricato_vini_preferiti;
-- MANTIENI: "select_public" (anon SELECT — serve /ref/[code])
-- MANTIENI: "modify_own" (ALL authenticated propri — già corretto)

-- Admin: tutto
CREATE POLICY "admin_all" ON incaricato_vini_preferiti FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```

#### `provvigioni_mensili`

```sql
DROP POLICY IF EXISTS "provvigioni_mensili_read" ON provvigioni_mensili;

CREATE POLICY "inc_select_own" ON provvigioni_mensili FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

CREATE POLICY "admin_all" ON provvigioni_mensili FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```
> Write incaricato: ❌ (solo batch admin via RPC SECURITY DEFINER)

#### `magazzino_consulente`

```sql
DROP POLICY IF EXISTS "magazzino_consulente_read" ON magazzino_consulente;

CREATE POLICY "inc_select_own" ON magazzino_consulente FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

CREATE POLICY "admin_all" ON magazzino_consulente FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```
> Write incaricato: ❌ ora — RPC gestione magazzino in M3

#### `movimenti_magazzino`

```sql
DROP POLICY IF EXISTS "movimenti_magazzino_read" ON movimenti_magazzino;

CREATE POLICY "inc_select_own" ON movimenti_magazzino FOR SELECT TO authenticated
  USING (
    magazzino_id IN (
      SELECT id FROM magazzino_consulente
      WHERE incaricato_id = current_incaricato_id()
    )
  );

CREATE POLICY "admin_all" ON movimenti_magazzino FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```
> Log immutabile: nessuna policy INSERT/UPDATE/DELETE per incaricato

#### `cantina_personale`

```sql
-- CHECK cantina_personale_utente_tipo_check già esistente da migration 003
-- (valori: 'INCARICATO', 'CLIENTE') — nessun ALTER TABLE necessario

DROP POLICY IF EXISTS "cantina_personale_read" ON cantina_personale;

CREATE POLICY "inc_own" ON cantina_personale FOR ALL TO authenticated
  USING (utente_tipo = 'INCARICATO' AND utente_id = current_incaricato_id())
  WITH CHECK (utente_tipo = 'INCARICATO' AND utente_id = current_incaricato_id());

CREATE POLICY "admin_all" ON cantina_personale FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```
> Righe con utente_tipo='CLIENTE': nessuna policy — gestito in M6 con auth cliente

---

### B — DATI TRANSAZIONALI

#### `clienti`

```sql
DROP POLICY IF EXISTS "clienti_read" ON clienti;

CREATE POLICY "inc_select_own" ON clienti FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_insert_own" ON clienti FOR INSERT TO authenticated
  WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_update_own" ON clienti FOR UPDATE TO authenticated
  USING (incaricato_id = current_incaricato_id())
  WITH CHECK (incaricato_id = current_incaricato_id());

-- Nessuna policy DELETE per incaricato → implicitamente negato
CREATE POLICY "admin_all" ON clienti FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```

#### `ordini`

```sql
DROP POLICY IF EXISTS "ordini_read" ON ordini;

CREATE POLICY "inc_select_own" ON ordini FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

-- INSERT diretto ammesso (form ordini usa INSERT diretto, no RPC ancora)
CREATE POLICY "inc_insert_own" ON ordini FOR INSERT TO authenticated
  WITH CHECK (incaricato_id = current_incaricato_id());

-- UPDATE/DELETE: solo admin
CREATE POLICY "admin_all" ON ordini FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```

#### `ordini_righe`

```sql
DROP POLICY IF EXISTS "ordini_righe_read" ON ordini_righe;

CREATE POLICY "inc_select_own" ON ordini_righe FOR SELECT TO authenticated
  USING (
    ordine_id IN (SELECT id FROM ordini WHERE incaricato_id = current_incaricato_id())
  );

CREATE POLICY "inc_insert_own" ON ordini_righe FOR INSERT TO authenticated
  WITH CHECK (
    ordine_id IN (SELECT id FROM ordini WHERE incaricato_id = current_incaricato_id())
  );

CREATE POLICY "admin_all" ON ordini_righe FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```

#### `lead`

```sql
DROP POLICY IF EXISTS "lead_read" ON lead;

CREATE POLICY "inc_select_own" ON lead FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_insert_own" ON lead FOR INSERT TO authenticated
  WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_update_own" ON lead FOR UPDATE TO authenticated
  USING (incaricato_id = current_incaricato_id())
  WITH CHECK (incaricato_id = current_incaricato_id());

-- Nessuna policy DELETE per incaricato
CREATE POLICY "admin_all" ON lead FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```

#### `interazioni_crm`

```sql
DROP POLICY IF EXISTS "interazioni_crm_read" ON interazioni_crm;

CREATE POLICY "inc_select_own" ON interazioni_crm FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_insert_own" ON interazioni_crm FOR INSERT TO authenticated
  WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_update_own" ON interazioni_crm FOR UPDATE TO authenticated
  USING (incaricato_id = current_incaricato_id())
  WITH CHECK (incaricato_id = current_incaricato_id());

-- Nessuna policy DELETE (audit trail)
CREATE POLICY "admin_all" ON interazioni_crm FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```

#### `eventi`

```sql
DROP POLICY IF EXISTS "eventi_read" ON eventi;

CREATE POLICY "inc_select_own" ON eventi FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_insert_own" ON eventi FOR INSERT TO authenticated
  WITH CHECK (incaricato_id = current_incaricato_id());

CREATE POLICY "inc_update_own" ON eventi FOR UPDATE TO authenticated
  USING (incaricato_id = current_incaricato_id())
  WITH CHECK (incaricato_id = current_incaricato_id());

-- Nessuna policy DELETE per incaricato (solo admin cancella eventi)
CREATE POLICY "admin_all" ON eventi FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```
> M2.7 (futura): aggiunge policy SELECT per tipo_evento='aziendale' visibile a tutti.
> La colonna tipo (enum tipo_evento) esiste già — M2.7 è solo CREATE POLICY aggiuntiva.

#### `eventi_partecipanti`

```sql
DROP POLICY IF EXISTS "eventi_partecipanti_read" ON eventi_partecipanti;

CREATE POLICY "inc_select_own" ON eventi_partecipanti FOR SELECT TO authenticated
  USING (
    evento_id IN (SELECT id FROM eventi WHERE incaricato_id = current_incaricato_id())
  );

CREATE POLICY "inc_insert_own" ON eventi_partecipanti FOR INSERT TO authenticated
  WITH CHECK (
    evento_id IN (SELECT id FROM eventi WHERE incaricato_id = current_incaricato_id())
  );

CREATE POLICY "admin_all" ON eventi_partecipanti FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```

#### `storni_pv`

```sql
DROP POLICY IF EXISTS "storni_pv_read" ON storni_pv;

CREATE POLICY "inc_select_own" ON storni_pv FOR SELECT TO authenticated
  USING (incaricato_id = current_incaricato_id());

-- Write: solo admin
CREATE POLICY "admin_all" ON storni_pv FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```

---

### C — REFERENCE TABLES (lettura pubblica)

```sql
-- prodotti
DROP POLICY IF EXISTS "prodotti_read" ON prodotti;
CREATE POLICY "public_read" ON prodotti FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_all" ON prodotti FOR ALL TO authenticated
  USING (current_is_admin()) WITH CHECK (current_is_admin());

-- regioni
DROP POLICY IF EXISTS "regioni_read" ON regioni;
CREATE POLICY "public_read" ON regioni FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_all" ON regioni FOR ALL TO authenticated
  USING (current_is_admin()) WITH CHECK (current_is_admin());

-- qualifiche
DROP POLICY IF EXISTS "qualifiche_read" ON qualifiche;
CREATE POLICY "public_read" ON qualifiche FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_all" ON qualifiche FOR ALL TO authenticated
  USING (current_is_admin()) WITH CHECK (current_is_admin());

-- cantine_fornitrici
DROP POLICY IF EXISTS "cantine_fornitrici_read" ON cantine_fornitrici;
CREATE POLICY "public_read" ON cantine_fornitrici FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_all" ON cantine_fornitrici FOR ALL TO authenticated
  USING (current_is_admin()) WITH CHECK (current_is_admin());

-- box_degustazione (anon ✅ — visibile su landing /ref/[code])
DROP POLICY IF EXISTS "box_degustazione_read" ON box_degustazione;
CREATE POLICY "public_read" ON box_degustazione FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_all" ON box_degustazione FOR ALL TO authenticated
  USING (current_is_admin()) WITH CHECK (current_is_admin());

-- box_degustazione_righe (eredita visibilità dal box padre)
DROP POLICY IF EXISTS "box_degustazione_righe_read" ON box_degustazione_righe;
CREATE POLICY "public_read" ON box_degustazione_righe FOR SELECT TO anon, authenticated
  USING (box_id IN (SELECT id FROM box_degustazione));
CREATE POLICY "admin_all" ON box_degustazione_righe FOR ALL TO authenticated
  USING (current_is_admin()) WITH CHECK (current_is_admin());
```

---

### D — ADMIN-ONLY

#### `candidature`

```sql
-- MANTIENI: "insert_public" (anon INSERT con with_check — già corretto)
DROP POLICY IF EXISTS "select_authenticated" ON candidature;

-- Incaricato vede solo la propria candidatura storica (via FK candidatura_id)
CREATE POLICY "inc_select_own_candidatura" ON candidature FOR SELECT TO authenticated
  USING (
    id = (SELECT candidatura_id FROM incaricati WHERE auth_user_id = auth.uid())
  );

-- Admin: tutto
CREATE POLICY "admin_all" ON candidature FOR ALL TO authenticated
  USING (current_is_admin())
  WITH CHECK (current_is_admin());
```

---

### E — Storage: fix bucket profili

```sql
-- Sanity check eseguito: "public_read" esiste SOLO su storage.objects per bucket 'profili'
-- Fix: sostituisce USING true con filtro su filename per bloccare listing

DROP POLICY IF EXISTS "public_read" ON storage.objects;

CREATE POLICY "profili_public_read_no_listing" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'profili'
    AND storage.filename(name) != ''
  );
```

> Le policy UPDATE (`update_own_photo`) e INSERT (`upload_own_photo`) restano invariate.

---

## Test da eseguire post-migration (FASE 4)

- Login `test@invinus.it` → dashboard carica (dati Francesco visibili)
- Login `test@invinus.it` → ordini di altri incaricati NON visibili
- Login `test@invinus.it` → campo `email` non restituito da SELECT diretto su incaricati
- Login `test@invinus.it` → `get_my_profile()` restituisce tutti i campi inclusa email
- Utente anon → `/ref/[code]` carica (vini_preferiti + prodotti + box accessibili)
- Utente anon → candidature INSERT riesce (con stato='in_attesa')
- Admin → `/admin/incaricati` carica (tutti i record, tutti i campi)
- Batch provvigioni (via admin route) → eseguito con successo
