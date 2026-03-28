-- =============================================================================
-- InVinus — Seed ordini demo (marzo 2026)
-- Scopo: popolare la dashboard con numeri reali per test/demo
--
-- Consulenti coinvolti:
--   1 = Francesco Panzella (DIRECTOR, top of tree)
--   2 = Giulia Mancini     (SUPERVISOR, sponsor=1, L1 di Francesco)
--   3 = Luca De Luca       (ADVISOR, sponsor=2, L2 di Francesco)
--
-- Risultati attesi su get_dashboard_consulente(1, 2026, 3):
--   pv_mese  = 365   (ordini 1-5 di Francesco)
--   gv_mese  = 185   (118 Giulia + 67 Luca)
--   fatturato_mese = 521.20
--   guadagni_stimati = 78.18  (521.20 × 15%)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- ORDINI — Francesco Panzella (consulente_id = 1)
-- ---------------------------------------------------------------------------

-- Ordine 1: 3× Brunello di Montalcino
-- Totale: 3×68.90 = 206.70 | PV: 3×49 = 147
WITH ins AS (
  INSERT INTO ordini (consulente_id, cliente_id, data, stato, tipo, totale, pv_generati)
  VALUES (1, 1, '2026-03-05 10:00:00+00', 'pagato', 'vendita', 206.70, 147)
  RETURNING id
)
INSERT INTO ordini_righe (ordine_id, prodotto_id, quantita, prezzo_unitario, pv_riga)
SELECT ins.id, 11, 3, 68.90, 147 FROM ins;

-- Ordine 2: 2× Chianti Classico Riserva + 1× Chianti Classico
-- Totale: 2×32.90 + 22.90 = 88.70 | PV: 2×23 + 16 = 62
WITH ins AS (
  INSERT INTO ordini (consulente_id, cliente_id, data, stato, tipo, totale, pv_generati)
  VALUES (1, 2, '2026-03-08 14:30:00+00', 'pagato', 'vendita', 88.70, 62)
  RETURNING id
)
INSERT INTO ordini_righe (ordine_id, prodotto_id, quantita, prezzo_unitario, pv_riga)
SELECT ins.id, 10, 2, 32.90, 46 FROM ins
UNION ALL
SELECT ins.id, 9,  1, 22.90, 16 FROM ins;

-- Ordine 3: 4× Aglianico del Sannio Riserva + 2× Barbera del Sannio
-- Totale: 4×18.90 + 2×12.90 = 101.40 | PV: 4×13 + 2×9 = 70
WITH ins AS (
  INSERT INTO ordini (consulente_id, cliente_id, data, stato, tipo, totale, pv_generati)
  VALUES (1, 3, '2026-03-12 11:00:00+00', 'pagato', 'vendita', 101.40, 70)
  RETURNING id
)
INSERT INTO ordini_righe (ordine_id, prodotto_id, quantita, prezzo_unitario, pv_riga)
SELECT ins.id, 1, 4, 18.90, 52 FROM ins
UNION ALL
SELECT ins.id, 3, 2, 12.90, 18 FROM ins;

-- Ordine 4: 1× Rosso di Montalcino + 3× Falanghina del Sannio
-- Totale: 24.90 + 3×12.90 = 63.60 | PV: 17 + 3×9 = 44
WITH ins AS (
  INSERT INTO ordini (consulente_id, cliente_id, data, stato, tipo, totale, pv_generati)
  VALUES (1, 4, '2026-03-18 16:00:00+00', 'pagato', 'vendita', 63.60, 44)
  RETURNING id
)
INSERT INTO ordini_righe (ordine_id, prodotto_id, quantita, prezzo_unitario, pv_riga)
SELECT ins.id, 12, 1, 24.90, 17 FROM ins
UNION ALL
SELECT ins.id, 4,  3, 12.90, 27 FROM ins;

-- Ordine 5: 2× Poggio Torto Toscana + 2× Greco del Sannio
-- Totale: 2×16.90 + 2×13.50 = 60.80 | PV: 2×12 + 2×9 = 42
WITH ins AS (
  INSERT INTO ordini (consulente_id, cliente_id, data, stato, tipo, totale, pv_generati)
  VALUES (1, 1, '2026-03-25 09:30:00+00', 'pagato', 'vendita', 60.80, 42)
  RETURNING id
)
INSERT INTO ordini_righe (ordine_id, prodotto_id, quantita, prezzo_unitario, pv_riga)
SELECT ins.id, 13, 2, 16.90, 24 FROM ins
UNION ALL
SELECT ins.id, 5,  2, 13.50, 18 FROM ins;

-- ---------------------------------------------------------------------------
-- ORDINI — Giulia Mancini (consulente_id = 2) — contribuisce al GV di Francesco
-- ---------------------------------------------------------------------------

-- Ordine 6: 3× Chianti Classico
-- Totale: 3×22.90 = 68.70 | PV: 3×16 = 48
WITH ins AS (
  INSERT INTO ordini (consulente_id, cliente_id, data, stato, tipo, totale, pv_generati)
  VALUES (2, 2, '2026-03-07 10:00:00+00', 'pagato', 'vendita', 68.70, 48)
  RETURNING id
)
INSERT INTO ordini_righe (ordine_id, prodotto_id, quantita, prezzo_unitario, pv_riga)
SELECT ins.id, 9, 3, 22.90, 48 FROM ins;

-- Ordine 7: 2× Aglianico del Sannio Riserva + 1× Fiano del Sannio
-- Totale: 2×18.90 + 13.50 = 51.30 | PV: 2×13 + 9 = 35
WITH ins AS (
  INSERT INTO ordini (consulente_id, cliente_id, data, stato, tipo, totale, pv_generati)
  VALUES (2, 3, '2026-03-14 15:00:00+00', 'pagato', 'vendita', 51.30, 35)
  RETURNING id
)
INSERT INTO ordini_righe (ordine_id, prodotto_id, quantita, prezzo_unitario, pv_riga)
SELECT ins.id, 1, 2, 18.90, 26 FROM ins
UNION ALL
SELECT ins.id, 6, 1, 13.50,  9 FROM ins;

-- Ordine 8: 1× Rosso di Montalcino + 2× Greco del Sannio
-- Totale: 24.90 + 2×13.50 = 51.90 | PV: 17 + 2×9 = 35
WITH ins AS (
  INSERT INTO ordini (consulente_id, cliente_id, data, stato, tipo, totale, pv_generati)
  VALUES (2, 4, '2026-03-21 11:30:00+00', 'pagato', 'vendita', 51.90, 35)
  RETURNING id
)
INSERT INTO ordini_righe (ordine_id, prodotto_id, quantita, prezzo_unitario, pv_riga)
SELECT ins.id, 12, 1, 24.90, 17 FROM ins
UNION ALL
SELECT ins.id, 5,  2, 13.50, 18 FROM ins;

-- ---------------------------------------------------------------------------
-- ORDINI — Luca De Luca (consulente_id = 3) — contribuisce al GV di Francesco
-- ---------------------------------------------------------------------------

-- Ordine 9: 2× Chianti Classico + 1× Barbera del Sannio
-- Totale: 2×22.90 + 12.90 = 58.70 | PV: 2×16 + 9 = 41
WITH ins AS (
  INSERT INTO ordini (consulente_id, cliente_id, data, stato, tipo, totale, pv_generati)
  VALUES (3, 1, '2026-03-10 09:00:00+00', 'pagato', 'vendita', 58.70, 41)
  RETURNING id
)
INSERT INTO ordini_righe (ordine_id, prodotto_id, quantita, prezzo_unitario, pv_riga)
SELECT ins.id, 9, 2, 22.90, 32 FROM ins
UNION ALL
SELECT ins.id, 3, 1, 12.90,  9 FROM ins;

-- Ordine 10: 2× Falanghina del Sannio + 1× Coda di Volpe del Sannio
-- Totale: 2×12.90 + 11.90 = 37.70 | PV: 2×9 + 8 = 26
WITH ins AS (
  INSERT INTO ordini (consulente_id, cliente_id, data, stato, tipo, totale, pv_generati)
  VALUES (3, 2, '2026-03-22 14:00:00+00', 'pagato', 'vendita', 37.70, 26)
  RETURNING id
)
INSERT INTO ordini_righe (ordine_id, prodotto_id, quantita, prezzo_unitario, pv_riga)
SELECT ins.id, 4, 2, 12.90, 18 FROM ins
UNION ALL
SELECT ins.id, 7, 1, 11.90,  8 FROM ins;

COMMIT;

-- ---------------------------------------------------------------------------
-- Riepilogo atteso
-- ---------------------------------------------------------------------------
-- Francesco (1): PV=365, fatturato=521.20, provvigione=78.18€
-- Giulia    (2): PV=118 (→ GV Francesco L1)
-- Luca      (3): PV=67  (→ GV Francesco L2)
-- GV Francesco  : 185 (118+67)
-- ---------------------------------------------------------------------------
