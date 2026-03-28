// =============================================================================
// Entry point del job — orchestra DB + engine in una singola transazione
// =============================================================================

import { Pool } from 'pg'
import { eseguiBatch } from './engine'
import {
  loadQualifiche,
  loadConsulentiMese,
  loadStorni,
  saveProvvigioni,
  savePromozioni,
  updateAttiviConsulenti,
} from './repository'
import { BatchResult } from './types'

/**
 * Calcola e persiste le provvigioni mensili.
 *
 * Tutto avviene in una singola transazione: se un qualsiasi step fallisce,
 * nessun dato viene salvato (rollback completo).
 *
 * @param pool                  Pool PostgreSQL
 * @param anno                  Anno di riferimento (es. 2026)
 * @param mese                  Mese di riferimento 1-12
 * @param globalPoolAllocazione Quota Global Pool per Golden, se mese di chiusura anno.
 *                              = (0.03 × fatturato_annuo) / n_golden_attivi_anno.
 *                              Passa 0 per tutti gli altri mesi.
 */
export async function calcolaProvvigioniMensili(
  pool: Pool,
  anno: number,
  mese: number,
  globalPoolAllocazione = 0
): Promise<BatchResult> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // ── Carica dati (in parallelo dove possibile) ─────────────────────────
    const [qualifiche, nodes, storni] = await Promise.all([
      loadQualifiche(pool),
      loadConsulentiMese(pool, anno, mese),
      loadStorni(pool, anno, mese),
    ])

    // ── Esegui i 6 step del batch (logica pura, in-memory) ────────────────
    const result = eseguiBatch(nodes, storni, qualifiche, anno, mese, globalPoolAllocazione)

    // ── Persisti risultati ────────────────────────────────────────────────
    await saveProvvigioni(client, result.provvigioni)
    await savePromozioni(client, result.promozioni)
    await updateAttiviConsulenti(client, result.provvigioni)

    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
