// =============================================================================
// Tipi per il servizio di calcolo provvigioni mensili
// =============================================================================

export type StatusConsulente =
  | 'STARTER'
  | 'APPRENTICE'
  | 'ADVISOR'
  | 'SUPERVISOR'
  | 'TEAM_COORDINATOR'
  | 'MANAGER'
  | 'DIRECTOR'
  | 'AMBASSADOR'
  | 'GOLDEN'

/** Ordinamento progressione carriera. Usato per confronti (> >=). */
export const STATUS_LEVEL: Record<StatusConsulente, number> = {
  STARTER: 0,
  APPRENTICE: 1,
  ADVISOR: 2,
  SUPERVISOR: 3,
  TEAM_COORDINATOR: 4,
  MANAGER: 5,
  DIRECTOR: 6,
  AMBASSADOR: 7,
  GOLDEN: 8,
}

export const ALL_STATUS: StatusConsulente[] = [
  'STARTER',
  'APPRENTICE',
  'ADVISOR',
  'SUPERVISOR',
  'TEAM_COORDINATOR',
  'MANAGER',
  'DIRECTOR',
  'AMBASSADOR',
  'GOLDEN',
]

export const MAX_LIVELLI = 8

// Importo Bonus Car mensile (DA DECIDERE — doc 12 §6).
// Placeholder fino a decisione con FP.
export const BONUS_CAR_IMPORTO_EUR = 250.00

// Soglia minima payout provvigioni (doc 12 §6, decisione suggerita: 10€).
export const SOGLIA_MINIMA_PAYOUT_EUR = 10.00

// ─── Strutture dati del dominio ──────────────────────────────────────────────

export interface Qualifica {
  status: StatusConsulente
  pvMin: number
  gvMin: number
  /** Frazione. Esempio: 0.15 per il 15%. */
  provvigionePers: number
  /** Array di 8 frazioni [L1, L2, ..., L8]. Zero dove non applicabile. */
  residualePerLivello: number[]
  /** Importo in € per consulente attivo nei livelli di retribuzione. */
  cabImporto: number
  haBonusCar: boolean
  haGlobalPool: boolean
}

/**
 * Stato di un consulente per il mese di calcolo.
 * Viene popolato progressivamente durante i 6 step del batch.
 */
export interface ConsulenteMese {
  id: number
  sponsorId: number | null
  status: StatusConsulente
  statusMax: StatusConsulente
  formazioneCompletata: boolean
  // ── Dati di input (da ordini del mese) ───────────────────────────────────
  /** PV lordi dal mese (prima degli storni). */
  pvLordo: number
  /** PV netti dopo applicazione storni. Aggiornato dallo step 1. */
  pvNetto: number
  /**
   * Fatturato personale in € (sum ordini.totale del mese).
   * È la base per la provvigione personale 15%.
   * Distinto da pvNetto: 1 PV ≈ 1€ (prezzo consulente), ma fatturato
   * è calcolato sul prezzo pubblico degli ordini.
   */
  fatturatoPersonale: number
  // ── Calcolati dallo step 2 (consolidaGvByLevel) ──────────────────────────
  /**
   * GV per livello di profondità nell'albero.
   * gvByLevel[0] = GV livello 1 (diretti), gvByLevel[1] = GV livello 2, ...
   * Somma totale = gvByLevel.reduce((s,v) => s+v, 0).
   */
  gvByLevel: number[]
  // ── Calcolato dallo step 3 (checkAttivita) ───────────────────────────────
  /**
   * Attivo se pvNetto >= qualifica.pvMin.
   * Fonte: doc 12 §3: "inattivo se PV_mese < PV_richiesto_dal_suo_status".
   * Il GV mensile NON è requisito di attività, solo di promozione (doc 12 §3).
   */
  attivo: boolean
}

export interface StornoRecord {
  consulenteId: number
  /** PV da sottrarre (già aggregati per consulente se multipli storni nello stesso mese). */
  pvStornati: number
}

export interface ProvvigioneResult {
  consulenteId: number
  anno: number
  mese: number
  pvMese: number
  gvMese: number
  statusAlCalcolo: StatusConsulente
  eraAttivo: boolean
  provvigionePersonale: number
  redditoResiduale: number
  /** Breakdown per livello: { l1: 12.90, l2: 8.25, ... }. Solo livelli con importo > 0. */
  residualeDettaglio: Record<string, number>
  cabBonus: number
  bonusCar: number
  /** Quota Global Pool (solo Golden attivi, calcolata annualmente dall'esterno). */
  globalPool: number
  totale: number
  /** True se totale < SOGLIA_MINIMA_PAYOUT_EUR → da accumulare, non pagare subito. */
  daAccumulare: boolean
}

export interface PromozioneResult {
  consulenteId: number
  statusPrecedente: StatusConsulente
  nuovoStatus: StatusConsulente
  nuovoStatusMax: StatusConsulente
}

export interface BatchResult {
  anno: number
  mese: number
  provvigioni: ProvvigioneResult[]
  promozioni: PromozioneResult[]
  storniApplicati: number
  consulentiAttivi: number
  consulentiInattivi: number
  /** Somma totale di tutte le provvigioni (incluse quelle sotto soglia). */
  totaleLordo: number
  /** Somma delle sole provvigioni da pagare subito (>= soglia). */
  totalePayout: number
}
