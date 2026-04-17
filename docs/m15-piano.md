# M1.5 — Piano rename consulente → incaricato

> Approvazione richiesta prima di toccare qualsiasi file.
> Dopo approvazione: FASE 3 — esecuzione su branch `feat/m1.5-rename`.

---

## File modificati

### DB
| File | Tipo |
|------|------|
| `db/migrations/003_rename_consulente_incaricato.sql` | CREA |
| `db/schema.sql` | MODIFICA |

### TypeScript
| File | Tipo |
|------|------|
| `web/src/types/supabase.ts` | MODIFICA (manuale, non rigenerata da CLI) |
| `web/src/proxy.ts` | MODIFICA |
| `web/src/components/Sidebar.tsx` | MODIFICA |
| `web/src/app/admin/consulenti/page.tsx` → `web/src/app/admin/incaricati/page.tsx` | SPOSTA + MODIFICA |
| `web/src/app/admin/consulenti/[id]/page.tsx` → `web/src/app/admin/incaricati/[id]/page.tsx` | SPOSTA + MODIFICA |
| `web/src/app/admin/dashboard/page.tsx` | MODIFICA |
| `web/src/app/(app)/dashboard/page.tsx` | MODIFICA |
| `web/src/app/(app)/team/page.tsx` | MODIFICA |
| `web/src/app/(app)/ordini/actions.ts` | MODIFICA |
| `web/src/app/(app)/clienti/actions.ts` | MODIFICA |
| `web/src/app/(app)/clienti/page.tsx` | MODIFICA |
| `web/src/app/(app)/clienti/[id]/page.tsx` | MODIFICA |
| `web/src/app/(app)/ordini/page.tsx` | MODIFICA |
| `web/src/app/(app)/provvigioni/page.tsx` | MODIFICA |
| `web/src/app/(app)/referral/gestisci/page.tsx` | MODIFICA |
| `web/src/app/(app)/referral/gestisci/GestisciClient.tsx` | MODIFICA |
| `web/src/app/ref/[code]/page.tsx` | MODIFICA |
| `web/src/app/api/admin/calcola-provvigioni/route.ts` | MODIFICA |
| `web/src/app/admin/candidature/CandidatureClient.tsx` | MODIFICA |
| `web/src/lib/provvigioni/types.ts` | MODIFICA |
| `web/src/lib/provvigioni/repository.ts` | MODIFICA |
| `web/src/lib/provvigioni/engine.ts` | MODIFICA |
| `web/src/lib/provvigioni/index.ts` | MODIFICA (se ha ref a consulente) |

### Docs
| File | Tipo |
|------|------|
| `CLAUDE.md` | MODIFICA (rimuove nota terminologica temporanea) |
| `docs/14-allineamento-produzione.md` | MODIFICA (aggiorna nomi) |

### NON TOCCARE
- `docs/progress/` — log storici immutabili
- `web/.env.local`, env vars, cookie names (`invinus_ruolo`, `invinus_referral`)
- Colonne `prezzo_consulente` in `prodotti` e `box_degustazione` (attributo prezzo, non FK persona)
- `magazzino_consulente` — nome tabella RESTA, solo la colonna `consulente_id` viene rinominata
- `lead.convertito_consulente_id` → `convertito_incaricato_id` (INCLUSO nel rename)

---

## db/migrations/003_rename_consulente_incaricato.sql

```sql
-- =============================================================================
-- Migrazione 003 — M1.5: rename consulente → incaricato
-- Data: 2026-04-17
--
-- ATTENZIONE: NON idempotente per design.
-- Dopo il primo run le tabelle/enum/indici hanno già i nomi nuovi.
-- Un secondo run fallirà con errori "does not exist".
-- Per rieseguire: rollback completo + ripristino backup.
--
-- STRUTTURA A DUE FASI (safety ALTER TYPE RENAME VALUE):
--   Postgres può emettere "unsafe use of new value" se un valore enum appena
--   rinominato viene usato nella stessa transazione. Per sicurezza:
--   FASE 1 — i due RENAME VALUE vengono eseguiti in autocommit, fuori da BEGIN.
--   FASE 2 — tutto il resto è in transazione atomica (BEGIN/COMMIT) così
--             un errore su qualsiasi step fa rollback dell'intera FASE 2.
--
-- Ordine di esecuzione:
--   FASE 1 (autocommit): RENAME enum values (2 statement)
--   FASE 2 BEGIN:
--   1.  DROP policy sulle tabelle da rinominare
--   3.  RENAME enum types
--   4.  RENAME tabelle
--   5.  RENAME colonne (consulente_id → incaricato_id + convertito_consulente_id)
--   6.  RENAME indici custom (idx_*)
--   7.  DROP funzioni vecchie (12 con nome da cambiare)
--   8.  CREATE funzioni rinominate con body aggiornato
--   9.  CREATE OR REPLACE funzioni che cambiano solo il body (3)
--   10. RECREATE policy sui nuovi nomi tabella
--   FASE 2 COMMIT
-- =============================================================================


-- ---------------------------------------------------------------------------
-- FASE 1 — RENAME enum values (autocommit — eseguire PRIMA del BEGIN)
-- ---------------------------------------------------------------------------
-- Postgres può emettere "unsafe use of new value" se questi RENAME VALUE
-- fossero nella stessa transazione che usa i valori appena rinominati.
-- Eseguirli qui, in autocommit, elimina il rischio.

-- ruolo_consulente: valore 'consulente' → 'incaricato' (ruolo utente standard)
ALTER TYPE ruolo_consulente RENAME VALUE 'consulente' TO 'incaricato';

-- stato_funnel_lead: valore 'consulente' → 'incaricato' (lead convertito)
ALTER TYPE stato_funnel_lead RENAME VALUE 'consulente' TO 'incaricato';


-- ---------------------------------------------------------------------------
-- FASE 2 — Tutto il resto in transazione atomica
-- ---------------------------------------------------------------------------
BEGIN;


-- ---------------------------------------------------------------------------
-- 1. DROP policy (prima del rename tabelle)
-- ---------------------------------------------------------------------------
-- Verificato il 2026-04-17 con pg_policies: 4 policy coinvolte
-- (consulenti_read, modify_own, select_all_authenticated, select_public).
-- Se in futuro vengono aggiunte altre policy a queste tabelle,
-- vanno incluse qui nel DROP + RECREATE.
DROP POLICY IF EXISTS modify_own               ON consulente_vini_preferiti;
DROP POLICY IF EXISTS select_all_authenticated ON consulente_vini_preferiti;
DROP POLICY IF EXISTS select_public            ON consulente_vini_preferiti;
DROP POLICY IF EXISTS consulenti_read          ON consulenti;


-- ---------------------------------------------------------------------------
-- 3. RENAME enum types
-- ---------------------------------------------------------------------------
ALTER TYPE status_consulente        RENAME TO status_incaricato;
ALTER TYPE stato_account_consulente RENAME TO stato_account_incaricato;
ALTER TYPE ruolo_consulente         RENAME TO ruolo_utente;


-- ---------------------------------------------------------------------------
-- 4. RENAME tabelle
-- ---------------------------------------------------------------------------
-- Postgres rinomina automaticamente: pkey, unique constraint, sequenze associate.
ALTER TABLE consulenti               RENAME TO incaricati;
ALTER TABLE consulente_vini_preferiti RENAME TO incaricato_vini_preferiti;


-- ---------------------------------------------------------------------------
-- 5. RENAME colonne consulente_id → incaricato_id (tutte le tabelle)
-- ---------------------------------------------------------------------------
ALTER TABLE clienti                   RENAME COLUMN consulente_id TO incaricato_id;
ALTER TABLE ordini                    RENAME COLUMN consulente_id TO incaricato_id;
ALTER TABLE provvigioni_mensili       RENAME COLUMN consulente_id TO incaricato_id;
ALTER TABLE incaricato_vini_preferiti RENAME COLUMN consulente_id TO incaricato_id;
ALTER TABLE eventi                    RENAME COLUMN consulente_id TO incaricato_id;
ALTER TABLE interazioni_crm           RENAME COLUMN consulente_id TO incaricato_id;
ALTER TABLE lead                      RENAME COLUMN consulente_id TO incaricato_id;
ALTER TABLE magazzino_consulente      RENAME COLUMN consulente_id TO incaricato_id;
ALTER TABLE storni_pv                 RENAME COLUMN consulente_id TO incaricato_id;
-- Colonna aggiuntiva in lead (FK a incaricati.id, nome contiene "consulente")
ALTER TABLE lead                      RENAME COLUMN convertito_consulente_id TO convertito_incaricato_id;


-- ---------------------------------------------------------------------------
-- 6. RENAME indici custom (idx_*)
-- ---------------------------------------------------------------------------
-- Indici su incaricati (ex consulenti) — pkey/unique già auto-rinominati da Postgres
ALTER INDEX idx_consulenti_sponsor  RENAME TO idx_incaricati_sponsor;
ALTER INDEX idx_consulenti_status   RENAME TO idx_incaricati_status;
ALTER INDEX idx_consulenti_email    RENAME TO idx_incaricati_email;
ALTER INDEX idx_consulenti_cf       RENAME TO idx_incaricati_cf;
ALTER INDEX idx_consulenti_referral RENAME TO idx_incaricati_referral;
-- idx_consulenti_auth_user potrebbe non esistere in produzione (sostituito da unique constraint)
ALTER INDEX IF EXISTS idx_consulenti_auth_user RENAME TO idx_incaricati_auth_user;
-- Indice su incaricato_vini_preferiti (ex consulente_vini_preferiti)
ALTER INDEX idx_vini_pref_consulente RENAME TO idx_vini_pref_incaricato;
-- Indici su altre tabelle (Decisione 2: Opzione A — rename tutti con "consulente" nel nome)
ALTER INDEX idx_ordini_consulente    RENAME TO idx_ordini_incaricato;
ALTER INDEX idx_clienti_consulente   RENAME TO idx_clienti_incaricato;
ALTER INDEX idx_mag_consulente       RENAME TO idx_mag_incaricato;
ALTER INDEX idx_lead_consulente      RENAME TO idx_lead_incaricato;
ALTER INDEX idx_crm_consulente       RENAME TO idx_crm_incaricato;


-- ---------------------------------------------------------------------------
-- 7. DROP funzioni vecchie (12 con nome da cambiare)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.aggiorna_profilo_consulente(character varying, character varying, character varying, character varying);
DROP FUNCTION IF EXISTS public.aggiungi_cliente_consulente(text, text, text, text);
DROP FUNCTION IF EXISTS public.candida_consulente(text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.crea_ordine_consulente(integer, text, jsonb);
DROP FUNCTION IF EXISTS public.get_admin_consulenti(integer, integer);
DROP FUNCTION IF EXISTS public.get_admin_top_consulenti(integer, integer, integer);
DROP FUNCTION IF EXISTS public.get_clienti_consulente(integer);
DROP FUNCTION IF EXISTS public.get_consulente_by_referral(text);
DROP FUNCTION IF EXISTS public.get_dashboard_consulente(integer, integer, integer);
DROP FUNCTION IF EXISTS public.get_team_consulente(integer, integer, integer);


-- ---------------------------------------------------------------------------
-- 8. CREATE funzioni rinominate con body aggiornato
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.aggiorna_profilo_incaricato(
  p_bio                character varying,
  p_messaggio_referral character varying,
  p_specialita         character varying,
  p_foto_url           character varying DEFAULT NULL::character varying
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE incaricati SET
    bio                = p_bio,
    messaggio_referral = p_messaggio_referral,
    specialita         = p_specialita,
    foto_url           = COALESCE(p_foto_url, foto_url)
  WHERE auth_user_id = auth.uid();
END;
$$;


CREATE OR REPLACE FUNCTION public.aggiungi_cliente_incaricato(
  p_nome text, p_cognome text, p_email text, p_telefono text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_incaricato_id INT;
  v_cliente_id    INT;
BEGIN
  SELECT id INTO v_incaricato_id FROM incaricati WHERE auth_user_id = auth.uid();
  IF v_incaricato_id IS NULL THEN RAISE EXCEPTION 'Incaricato non trovato'; END IF;

  INSERT INTO clienti (incaricato_id, nome, cognome, email, telefono, gdpr_consenso)
  VALUES (v_incaricato_id, p_nome, p_cognome, p_email, p_telefono, false)
  RETURNING id INTO v_cliente_id;

  RETURN v_cliente_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.candida_incaricato(
  p_nome text, p_cognome text, p_email text,
  p_telefono text, p_motivazione text, p_referral_code text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id INT;
BEGIN
  INSERT INTO candidature(nome, cognome, email, telefono, motivazione, sponsor_referral_code)
  VALUES (p_nome, p_cognome, p_email, p_telefono, p_motivazione, NULLIF(p_referral_code,''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


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
  v_riga          JSONB;
  v_righe_arr     JSONB[];
  v_prod          RECORD;
  v_totale        NUMERIC := 0;
  v_pv_tot        NUMERIC := 0;
BEGIN
  SELECT id INTO v_incaricato_id
  FROM incaricati
  WHERE auth_user_id = auth.uid();

  IF v_incaricato_id IS NULL THEN
    RAISE EXCEPTION 'Incaricato non trovato';
  END IF;

  INSERT INTO ordini (incaricato_id, cliente_id, data, stato, tipo, totale, pv_generati)
  VALUES (v_incaricato_id, p_cliente_id, NOW(), 'pagato', p_tipo::tipo_ordine, 0, 0)
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


CREATE OR REPLACE FUNCTION public.get_admin_incaricati(p_anno integer, p_mese integer)
RETURNS TABLE(
  id integer, nome text, cognome text, status text, ruolo text,
  pv_mese numeric, gv_mese numeric,
  sponsor_nome text, sponsor_cognome text,
  data_iscrizione timestamp with time zone, attivo boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH pv AS (
    SELECT incaricato_id, COALESCE(SUM(pv_generati),0) AS pv
    FROM ordini WHERE stato='pagato'
      AND EXTRACT(YEAR FROM data)=p_anno AND EXTRACT(MONTH FROM data)=p_mese
    GROUP BY incaricato_id
  ),
  gv AS (
    SELECT c2.sponsor_id, COALESCE(SUM(o.pv_generati),0) AS gv
    FROM ordini o JOIN incaricati c2 ON c2.id=o.incaricato_id
    WHERE o.stato='pagato'
      AND EXTRACT(YEAR FROM o.data)=p_anno AND EXTRACT(MONTH FROM o.data)=p_mese
      AND c2.sponsor_id IS NOT NULL
    GROUP BY c2.sponsor_id
  )
  SELECT
    c.id, c.nome::TEXT, c.cognome::TEXT, c.status::TEXT, c.ruolo::TEXT,
    COALESCE(p.pv,0) AS pv_mese,
    COALESCE(g.gv,0) AS gv_mese,
    s.nome::TEXT, s.cognome::TEXT,
    c.data_iscrizione,
    COALESCE(p.pv,0) >= q.pv_min AS attivo
  FROM incaricati c
  LEFT JOIN pv p ON p.incaricato_id = c.id
  LEFT JOIN gv g ON g.sponsor_id    = c.id
  LEFT JOIN incaricati s ON s.id    = c.sponsor_id
  JOIN qualifiche q ON q.status     = c.status
  ORDER BY c.status DESC, pv_mese DESC;
$$;


CREATE OR REPLACE FUNCTION public.get_admin_top_incaricati(
  p_anno integer, p_mese integer, p_limit integer DEFAULT 5
)
RETURNS TABLE(id integer, nome text, cognome text, status text, pv_mese numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.nome::TEXT, c.cognome::TEXT, c.status::TEXT,
         COALESCE(SUM(o.pv_generati), 0) AS pv_mese
  FROM incaricati c
  LEFT JOIN ordini o ON o.incaricato_id = c.id AND o.stato = 'pagato'
    AND EXTRACT(YEAR FROM o.data) = p_anno
    AND EXTRACT(MONTH FROM o.data) = p_mese
  GROUP BY c.id, c.nome, c.cognome, c.status
  ORDER BY pv_mese DESC
  LIMIT p_limit;
$$;


CREATE OR REPLACE FUNCTION public.get_clienti_incaricato(p_incaricato_id integer)
RETURNS TABLE(
  id integer, nome text, cognome text, email text, telefono text, segmento text,
  data_primo_acquisto timestamp with time zone,
  ultimo_ordine timestamp with time zone,
  n_ordini integer, totale_speso numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.id, c.nome::TEXT, c.cognome::TEXT, c.email::TEXT, c.telefono::TEXT,
    c.segmento::TEXT, c.data_primo_acquisto,
    MAX(o.data)                AS ultimo_ordine,
    COUNT(o.id)::INT           AS n_ordini,
    COALESCE(SUM(o.totale), 0) AS totale_speso
  FROM clienti c
  LEFT JOIN ordini o ON o.cliente_id = c.id AND o.stato != 'annullato'
  WHERE c.incaricato_id = p_incaricato_id
  GROUP BY c.id, c.nome, c.cognome, c.email, c.telefono, c.segmento, c.data_primo_acquisto
  ORDER BY MAX(o.data) DESC NULLS LAST, c.cognome;
$$;


CREATE OR REPLACE FUNCTION public.get_incaricato_by_referral(p_code text)
RETURNS TABLE(
  id integer, nome text, cognome text, status text,
  foto_url text, bio text, messaggio_referral text, specialita text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, nome::TEXT, cognome::TEXT, status::TEXT,
         foto_url::TEXT, bio::TEXT, messaggio_referral::TEXT, specialita::TEXT
  FROM incaricati WHERE link_referral = p_code;
$$;


CREATE OR REPLACE FUNCTION public.get_dashboard_incaricato(
  p_incaricato_id integer, p_anno integer, p_mese integer
)
RETURNS TABLE(
  nome text, cognome text, status text, status_max text,
  pv_min numeric, gv_min numeric, gv_prossimo numeric,
  pv_mese numeric, gv_mese numeric,
  gv_l1 numeric, gv_l2 numeric, gv_l3 numeric, gv_l4 numeric,
  gv_l5 numeric, gv_l6 numeric, gv_l7 numeric, gv_l8 numeric,
  fatturato_mese numeric, provvigione_pers numeric,
  guadagno_personale numeric, reddito_residuale numeric, guadagno_totale numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE downline AS (
    SELECT id, 0 AS livello
    FROM incaricati WHERE id = p_incaricato_id
    UNION ALL
    SELECT c.id, d.livello + 1
    FROM incaricati c
    JOIN downline d ON c.sponsor_id = d.id
    WHERE d.livello < 8
  ),
  pv_personali AS (
    SELECT
      COALESCE(SUM(o.pv_generati), 0) AS pv,
      COALESCE(SUM(o.totale),      0) AS fatturato
    FROM ordini o
    WHERE o.incaricato_id = p_incaricato_id
      AND o.stato = 'pagato'
      AND EXTRACT(YEAR  FROM o.data) = p_anno
      AND EXTRACT(MONTH FROM o.data) = p_mese
  ),
  gv_by_level AS (
    SELECT d.livello, COALESCE(SUM(o.pv_generati), 0) AS gv
    FROM downline d
    LEFT JOIN ordini o ON o.incaricato_id = d.id
      AND o.stato = 'pagato'
      AND EXTRACT(YEAR  FROM o.data) = p_anno
      AND EXTRACT(MONTH FROM o.data) = p_mese
    WHERE d.livello BETWEEN 1 AND 8
    GROUP BY d.livello
  ),
  q AS (
    SELECT qq.*
    FROM qualifiche qq
    JOIN incaricati c ON c.status = qq.status
    WHERE c.id = p_incaricato_id
  ),
  residuale AS (
    SELECT COALESCE(SUM(
      CASE g.livello
        WHEN 1 THEN g.gv * q.residuale_l1
        WHEN 2 THEN g.gv * q.residuale_l2
        WHEN 3 THEN g.gv * q.residuale_l3
        WHEN 4 THEN g.gv * q.residuale_l4
        WHEN 5 THEN g.gv * q.residuale_l5
        WHEN 6 THEN g.gv * q.residuale_l6
        WHEN 7 THEN g.gv * q.residuale_l7
        WHEN 8 THEN g.gv * q.residuale_l8
        ELSE 0
      END
    ), 0) AS totale
    FROM gv_by_level g, q
  ),
  status_order AS (
    SELECT status, ROW_NUMBER() OVER (ORDER BY gv_min, pv_min) AS lvl
    FROM qualifiche
  ),
  next_gv AS (
    SELECT qq.gv_min AS gv_prossimo
    FROM qualifiche qq
    JOIN status_order so_curr ON so_curr.status = (SELECT c.status FROM incaricati c WHERE c.id = p_incaricato_id)
    JOIN status_order so_next ON so_next.lvl = so_curr.lvl + 1
    WHERE qq.status = so_next.status
  )
  SELECT
    c.nome::TEXT, c.cognome::TEXT, c.status::TEXT, c.status_max::TEXT,
    q.pv_min, q.gv_min,
    COALESCE((SELECT gv_prossimo FROM next_gv), q.gv_min),
    pv_personali.pv,
    (SELECT COALESCE(SUM(g.gv), 0) FROM gv_by_level g),
    COALESCE((SELECT g.gv FROM gv_by_level g WHERE g.livello = 1), 0),
    COALESCE((SELECT g.gv FROM gv_by_level g WHERE g.livello = 2), 0),
    COALESCE((SELECT g.gv FROM gv_by_level g WHERE g.livello = 3), 0),
    COALESCE((SELECT g.gv FROM gv_by_level g WHERE g.livello = 4), 0),
    COALESCE((SELECT g.gv FROM gv_by_level g WHERE g.livello = 5), 0),
    COALESCE((SELECT g.gv FROM gv_by_level g WHERE g.livello = 6), 0),
    COALESCE((SELECT g.gv FROM gv_by_level g WHERE g.livello = 7), 0),
    COALESCE((SELECT g.gv FROM gv_by_level g WHERE g.livello = 8), 0),
    pv_personali.fatturato,
    q.provvigione_pers,
    pv_personali.pv * q.provvigione_pers,
    residuale.totale,
    pv_personali.pv * q.provvigione_pers + residuale.totale
  FROM incaricati c, q, pv_personali, residuale
  WHERE c.id = p_incaricato_id;
$$;


CREATE OR REPLACE FUNCTION public.get_team_incaricato(
  p_incaricato_id integer, p_anno integer, p_mese integer
)
RETURNS TABLE(
  id integer, nome text, cognome text, status text,
  pv_mese integer, pv_min integer, livello integer, sponsor_id integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE downline AS (
    SELECT c.id AS cid, c.nome AS cnome, c.cognome AS ccognome,
           c.status AS cstatus, c.sponsor_id AS csponsor, 1 AS cliv
    FROM incaricati c
    WHERE c.sponsor_id = p_incaricato_id

    UNION ALL

    SELECT c.id, c.nome, c.cognome, c.status, c.sponsor_id, d.cliv + 1
    FROM incaricati c
    JOIN downline d ON c.sponsor_id = d.cid
    WHERE d.cliv < 8
  ),
  pv_calc AS (
    SELECT
      o.incaricato_id,
      COALESCE(SUM(o.pv_generati), 0)::INT AS pv_tot
    FROM ordini o
    WHERE o.stato = 'pagato'
      AND EXTRACT(YEAR  FROM o.data) = p_anno
      AND EXTRACT(MONTH FROM o.data) = p_mese
      AND o.incaricato_id IN (SELECT d.cid FROM downline d)
    GROUP BY o.incaricato_id
  )
  SELECT
    d.cid::INT,
    d.cnome::TEXT,
    d.ccognome::TEXT,
    d.cstatus::TEXT,
    COALESCE(p.pv_tot, 0)::INT,
    q.pv_min::INT,
    d.cliv::INT,
    d.csponsor::INT
  FROM downline d
  JOIN qualifiche q ON q.status = d.cstatus
  LEFT JOIN pv_calc p ON p.incaricato_id = d.cid
  ORDER BY d.cliv, d.cid;
END;
$$;


-- ---------------------------------------------------------------------------
-- 9. CREATE OR REPLACE funzioni che cambiano solo il body (nomi invariati)
-- ---------------------------------------------------------------------------
-- Delle 15 funzioni presenti in produzione, 2 non richiedono modifiche:
-- get_admin_trend: body verificato, nessun riferimento a consulente/consulenti → non necessita rename
-- rls_auto_enable: utility Supabase interna, nessun riferimento a consulente → non toccata

-- get_admin_kpi: body aggiornato (consulenti → incaricati, incaricato_id)
-- Nota: campo di output 'consulenti_attivi' rinominato a 'incaricati_attivi'
CREATE OR REPLACE FUNCTION public.get_admin_kpi(p_anno integer, p_mese integer)
RETURNS TABLE(
  fatturato_mese numeric, ordini_mese integer,
  incaricati_attivi integer, nuovi_iscritti integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(SUM(o.totale), 0)  AS fatturato_mese,
    COUNT(o.id)::INT             AS ordini_mese,
    (SELECT COUNT(*)::INT FROM incaricati c2
     JOIN qualifiche q ON q.status = c2.status
     WHERE EXISTS (
       SELECT 1 FROM ordini o2
       WHERE o2.incaricato_id = c2.id AND o2.stato = 'pagato'
         AND EXTRACT(YEAR FROM o2.data) = p_anno
         AND EXTRACT(MONTH FROM o2.data) = p_mese
         AND (SELECT SUM(o3.pv_generati) FROM ordini o3
              WHERE o3.incaricato_id = c2.id AND o3.stato='pagato'
                AND EXTRACT(YEAR FROM o3.data)=p_anno
                AND EXTRACT(MONTH FROM o3.data)=p_mese) >= q.pv_min
     ))                          AS incaricati_attivi,
    (SELECT COUNT(*)::INT FROM incaricati
     WHERE EXTRACT(YEAR FROM data_iscrizione) = p_anno
       AND EXTRACT(MONTH FROM data_iscrizione) = p_mese) AS nuovi_iscritti
  FROM ordini o
  WHERE o.stato = 'pagato'
    AND EXTRACT(YEAR FROM o.data) = p_anno
    AND EXTRACT(MONTH FROM o.data) = p_mese;
$$;


-- set_referral_code: body aggiornato (consulenti → incaricati)
CREATE OR REPLACE FUNCTION public.set_referral_code(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_code !~ '^[A-Za-z0-9_-]{3,40}$' THEN
    RAISE EXCEPTION 'Codice non valido: usa solo lettere, numeri, - e _ (3-40 caratteri)';
  END IF;
  IF EXISTS (SELECT 1 FROM incaricati WHERE link_referral = p_code AND auth_user_id != auth.uid()) THEN
    RAISE EXCEPTION 'Codice già in uso';
  END IF;
  UPDATE incaricati SET link_referral = p_code WHERE auth_user_id = auth.uid();
END;
$$;


-- set_vini_preferiti: body aggiornato (incaricati, incaricato_vini_preferiti, incaricato_id)
CREATE OR REPLACE FUNCTION public.set_vini_preferiti(p_prodotto_ids integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_incaricato_id INT;
BEGIN
  SELECT id INTO v_incaricato_id FROM incaricati WHERE auth_user_id = auth.uid();
  DELETE FROM incaricato_vini_preferiti WHERE incaricato_id = v_incaricato_id;
  INSERT INTO incaricato_vini_preferiti (incaricato_id, prodotto_id, ordine)
  SELECT v_incaricato_id, pid, idx
  FROM unnest(p_prodotto_ids) WITH ORDINALITY AS t(pid, idx);
END;
$$;


-- ---------------------------------------------------------------------------
-- 10. RECREATE policy (sui nuovi nomi tabella)
-- ---------------------------------------------------------------------------
-- Le policy vengono rinominate per coerenza nomenclatura: il naming in dashboard
-- Supabase e nei commenti beneficia dall'allineamento al nuovo nome tabella.
-- Il comportamento (USING true) resta identico.

-- Policy su incaricati (ex consulenti) — rinominata per coerenza
CREATE POLICY incaricati_read ON public.incaricati
  FOR SELECT TO authenticated USING (true);

-- Policy su incaricato_vini_preferiti (ex consulente_vini_preferiti)
CREATE POLICY modify_own ON public.incaricato_vini_preferiti
  FOR ALL TO authenticated
  USING (incaricato_id = (
    SELECT incaricati.id FROM incaricati
    WHERE incaricati.auth_user_id = auth.uid()
  ));

CREATE POLICY select_all_authenticated ON public.incaricato_vini_preferiti
  FOR SELECT TO authenticated USING (true);

CREATE POLICY select_public ON public.incaricato_vini_preferiti
  FOR SELECT TO anon USING (true);

COMMIT;
```

---

## Conteggio statement SQL migration 003

| Categoria | N. statement |
|-----------|-------------|
| DROP policy | 4 |
| RENAME enum value | 2 |
| RENAME enum type | 3 |
| RENAME table | 2 |
| RENAME column | 10 |
| RENAME index | 12 |
| DROP function | 10 |
| CREATE function (nuova) | 8 |
| CREATE OR REPLACE function (body only) | 3 |
| CREATE policy | 4 |
| **Totale** | **58** |

---

## Modifiche TypeScript — pattern search-replace

### Pattern globali (web/src/**)

Applica nell'ordine indicato per evitare doppi-rename:

| Da | A | Note |
|----|---|------|
| `"consulenti"` | `"incaricati"` | String Supabase `.from()` e relationship |
| `"consulente_vini_preferiti"` | `"incaricato_vini_preferiti"` | String Supabase `.from()` |
| `"consulente_id"` | `"incaricato_id"` | Colonna in `.eq()`, `.select()`, `.insert()` |
| `"convertito_consulente_id"` | `"convertito_incaricato_id"` | Solo in lead (raro) |
| `"get_admin_consulenti"` | `"get_admin_incaricati"` | RPC name |
| `"get_admin_top_consulenti"` | `"get_admin_top_incaricati"` | RPC name |
| `"get_clienti_consulente"` | `"get_clienti_incaricato"` | RPC name |
| `"get_consulente_by_referral"` | `"get_incaricato_by_referral"` | RPC name |
| `"get_dashboard_consulente"` | `"get_dashboard_incaricato"` | RPC name |
| `"get_team_consulente"` | `"get_team_incaricato"` | RPC name |
| `"aggiorna_profilo_consulente"` | `"aggiorna_profilo_incaricato"` | RPC name |
| `"aggiungi_cliente_consulente"` | `"aggiungi_cliente_incaricato"` | RPC name |
| `"candida_consulente"` | `"candida_incaricato"` | RPC name |
| `"crea_ordine_consulente"` | `"crea_ordine_incaricato"` | RPC name |
| `consulenti_attivi` | `incaricati_attivi` | Campo ritorno get_admin_kpi |
| `p_consulente_id` | `p_incaricato_id` | Parametro RPC (supabase.ts args) |
| `StatusConsulente` | `StatusIncaricato` | TypeScript type |
| `ConsulenteMese` | `IncaricatoMese` | TypeScript interface |
| `consulenteId` | `incaricatoId` (camelCase) | Proprietà oggetti TS |
| `"Consulente InVinus"` | `"Incaricato InVinus"` | UI copy |
| `"Gestione Consulenti"` | `"Gestione Incaricati"` | Sidebar label |
| `"crea consulente"` | `"crea incaricato"` | Button copy |
| `"Consulente"` (label UI) | `"Incaricato"` | Footer Sidebar |
| `"/admin/consulenti"` | `"/admin/incaricati"` | Route href |

### ESCLUDI da search-replace (non rinominare)
- `prezzo_consulente` — colonna prezzo in `prodotti` e `box_degustazione`, NON è FK persona
- `"ruolo_consulente"` → la enum si chiama ora `ruolo_utente` ma in TS è già referenziata come `Database["public"]["Enums"]["ruolo_consulente"]` che va aggiornato a `ruolo_utente`
- `status_consulente` → `status_incaricato` (in supabase.ts)
- `stato_account_consulente` → `stato_account_incaricato` (in supabase.ts)

---

## Redirect in proxy.ts

Aggiungere dopo la sezione "Route pubbliche":

```typescript
// Redirect permanente bookmark /admin/consulenti → /admin/incaricati
if (pathname.startsWith("/admin/consulenti")) {
  const url = request.nextUrl.clone();
  url.pathname = pathname.replace("/admin/consulenti", "/admin/incaricati");
  return NextResponse.redirect(url, { status: 301 });
}
```

---

## Aggiornamento CLAUDE.md

Rimuovere la sezione "### Nota terminologica (temporanea)" e sostituire con:

```markdown
### Terminologia ufficiale

La figura venditoriale si chiama **incaricato alle vendite** ai sensi della L.173/2005 e D.Lgs. 114/98.
Nel codice, schema DB, RPC e UI il termine è uniformemente **incaricato**.
Non usare "consulente" in nuovo codice.
I log storici in `docs/progress/` restano immutati (record cronologico).
```

---

## Checklist verifica post-esecuzione (FASE 4)

- [ ] Eseguire `003_rename_consulente_incaricato.sql` in Supabase SQL Editor
- [ ] `npm run build` → 0 errori TypeScript
- [ ] `npm run dev` → login come test@invinus.it
- [ ] Sidebar mostra "Gestione Incaricati"
- [ ] `/admin/incaricati` carica la lista
- [ ] `/admin/consulenti` redirige a `/admin/incaricati` (HTTP 301)
- [ ] Dashboard incaricato carica (PV/GV/status)
- [ ] `/admin/provvigioni` calcolo ancora: 4 attivi, 1 inattivo, €203.92
- [ ] Creazione ordine funziona
- [ ] `/ref/FrancescoP` ancora funziona
- [ ] `grep -r "\.from(\"consulenti\")" web/src/` → 0 risultati
- [ ] `grep -r "consulente_id" web/src/` → 0 risultati (escluso prezzo_consulente)
- [ ] Merge branch + push + Vercel redeploy + smoke test produzione
