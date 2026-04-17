// =============================================================================
// Repository — query DB per il batch provvigioni
// =============================================================================

import { Pool, PoolClient } from 'pg'
import {
  StatusIncaricato,
  Qualifica,
  IncaricatoMese,
  StornoRecord,
  ProvvigioneResult,
  PromozioneResult,
} from './types'

// ─── Caricamento dati ────────────────────────────────────────────────────────

export async function loadQualifiche(pool: Pool): Promise<Map<StatusIncaricato, Qualifica>> {
  const res = await pool.query<{
    status: string
    pv_min: string
    gv_min: string
    provvigione_pers: string
    residuale_l1: string
    residuale_l2: string
    residuale_l3: string
    residuale_l4: string
    residuale_l5: string
    residuale_l6: string
    residuale_l7: string
    residuale_l8: string
    cab_importo: string
    ha_bonus_car: boolean
    ha_global_pool: boolean
  }>('SELECT * FROM qualifiche')

  const map = new Map<StatusIncaricato, Qualifica>()
  for (const row of res.rows) {
    map.set(row.status as StatusIncaricato, {
      status: row.status as StatusIncaricato,
      pvMin: parseInt(row.pv_min),
      gvMin: parseInt(row.gv_min),
      provvigionePers: parseFloat(row.provvigione_pers),
      residualePerLivello: [
        parseFloat(row.residuale_l1),
        parseFloat(row.residuale_l2),
        parseFloat(row.residuale_l3),
        parseFloat(row.residuale_l4),
        parseFloat(row.residuale_l5),
        parseFloat(row.residuale_l6),
        parseFloat(row.residuale_l7),
        parseFloat(row.residuale_l8),
      ],
      cabImporto: parseFloat(row.cab_importo),
      haBonusCar: row.ha_bonus_car,
      haGlobalPool: row.ha_global_pool,
    })
  }
  return map
}

/**
 * Carica tutti gli incaricati non cancellati/dormienti con i PV/fatturato
 * del mese indicato (calcolati dagli ordini in stato 'pagato').
 *
 * Nota: un incaricato con zero ordini nel mese viene comunque incluso
 * (pvNetto=0, fatturatoPersonale=0) per il check attività e il GV upline.
 */
export async function loadIncaricatiMese(
  pool: Pool,
  anno: number,
  mese: number
): Promise<Map<number, IncaricatoMese>> {
  const res = await pool.query<{
    id: number
    sponsor_id: number | null
    status: string
    status_max: string
    formazione_completata: boolean
    pv_lordo: string
    fatturato_personale: string
  }>(
    `SELECT
       c.id,
       c.sponsor_id,
       c.status,
       c.status_max,
       c.formazione_completata,
       COALESCE(SUM(o.pv_generati), 0)::text  AS pv_lordo,
       COALESCE(SUM(o.totale),      0)::text  AS fatturato_personale
     FROM incaricati c
     LEFT JOIN ordini o
       ON  o.incaricato_id = c.id
       AND EXTRACT(YEAR  FROM o.data) = $1
       AND EXTRACT(MONTH FROM o.data) = $2
       AND o.stato = 'pagato'
     WHERE c.stato_account NOT IN ('cancellato', 'dormiente')
     GROUP BY c.id`,
    [anno, mese]
  )

  const map = new Map<number, IncaricatoMese>()
  for (const row of res.rows) {
    const pv = parseFloat(row.pv_lordo)
    map.set(row.id, {
      id: row.id,
      sponsorId: row.sponsor_id,
      status: row.status as StatusIncaricato,
      statusMax: row.status_max as StatusIncaricato,
      formazioneCompletata: row.formazione_completata,
      pvLordo: pv,
      pvNetto: pv,  // sarà ridotto dallo step 1 se ci sono storni
      fatturatoPersonale: parseFloat(row.fatturato_personale),
      gvByLevel: [],
      attivo: false,
    })
  }
  return map
}

/**
 * Carica gli storni PV del mese, aggregati per incaricato.
 * Più storni per lo stesso incaricato nello stesso mese vengono sommati.
 */
export async function loadStorni(
  pool: Pool,
  anno: number,
  mese: number
): Promise<StornoRecord[]> {
  const res = await pool.query<{ incaricato_id: number; pv_stornati: string }>(
    `SELECT incaricato_id, SUM(pv_stornati)::text AS pv_stornati
     FROM storni_pv
     WHERE anno = $1 AND mese = $2
     GROUP BY incaricato_id`,
    [anno, mese]
  )
  return res.rows.map(r => ({
    incaricatoId: r.incaricato_id,
    pvStornati: parseFloat(r.pv_stornati),
  }))
}

// ─── Persistenza risultati ───────────────────────────────────────────────────

/**
 * Salva le provvigioni calcolate in provvigioni_mensili.
 * Usa UPSERT: sicuro se il job viene rieseguito nello stesso mese (idempotente).
 * Accetta un PoolClient per partecipare a una transazione esterna.
 */
export async function saveProvvigioni(
  client: PoolClient,
  provvigioni: ProvvigioneResult[]
): Promise<void> {
  for (const p of provvigioni) {
    await client.query(
      `INSERT INTO provvigioni_mensili (
         incaricato_id, anno, mese,
         pv_mese, gv_mese, status_al_calcolo, era_attivo,
         provvigione_personale, reddito_residuale, residuale_dettaglio,
         cab_bonus, bonus_car, global_pool, totale, stato, data_calcolo
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,'calcolato',NOW())
       ON CONFLICT (incaricato_id, anno, mese) DO UPDATE SET
         pv_mese               = EXCLUDED.pv_mese,
         gv_mese               = EXCLUDED.gv_mese,
         status_al_calcolo     = EXCLUDED.status_al_calcolo,
         era_attivo            = EXCLUDED.era_attivo,
         provvigione_personale = EXCLUDED.provvigione_personale,
         reddito_residuale     = EXCLUDED.reddito_residuale,
         residuale_dettaglio   = EXCLUDED.residuale_dettaglio,
         cab_bonus             = EXCLUDED.cab_bonus,
         bonus_car             = EXCLUDED.bonus_car,
         global_pool           = EXCLUDED.global_pool,
         totale                = EXCLUDED.totale,
         stato                 = 'calcolato',
         data_calcolo          = NOW()`,
      [
        p.incaricatoId, p.anno, p.mese,
        p.pvMese, p.gvMese, p.statusAlCalcolo, p.eraAttivo,
        p.provvigionePersonale, p.redditoResiduale,
        JSON.stringify(p.residualeDettaglio),
        p.cabBonus, p.bonusCar, p.globalPool, p.totale,
      ]
    )
  }
}

/**
 * Applica le promozioni su incaricati.
 * status e status_max vengono aggiornati atomicamente nella transazione del batch.
 */
export async function savePromozioni(
  client: PoolClient,
  promozioni: PromozioneResult[]
): Promise<void> {
  for (const p of promozioni) {
    await client.query(
      `UPDATE incaricati
       SET status = $2, status_max = $3, data_ultimo_status_change = NOW()
       WHERE id = $1`,
      [p.incaricatoId, p.nuovoStatus, p.nuovoStatusMax]
    )
  }
}

/**
 * Aggiorna i flag di attività e i contatori PV/GV correnti sugli incaricati.
 * Serve alla dashboard e alle notifiche in tempo reale.
 */
export async function updateAttiviConsulenti(
  client: PoolClient,
  provvigioni: ProvvigioneResult[]
): Promise<void> {
  for (const p of provvigioni) {
    await client.query(
      `UPDATE incaricati
       SET attivo = $2, pv_mese_corrente = $3, gv_mese_corrente = $4
       WHERE id = $1`,
      [p.incaricatoId, p.eraAttivo, p.pvMese, p.gvMese]
    )
  }
}
