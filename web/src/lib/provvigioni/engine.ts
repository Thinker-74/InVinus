// =============================================================================
// Engine di calcolo provvigioni — logica pura, nessun I/O
//
// Ordine batch obbligatorio (doc 12 §9):
//   1. applicaStorni()        — storna PV da resi del mese
//   2. consolidaGvByLevel()   — consolida PV/GV per livello (tree traversal)
//   3. checkAttivita()        — determina chi è attivo (PV >= requisito)
//   4. verificaPromozioni()   — promuove chi soddisfa i requisiti (irreversibile)
//   5. calcolaProvvigioni()   — calcola tutto: provv. personale + residuale + CAB + Car
//   6. (inline in step 5)     — applica soglia minima payout
// =============================================================================

import {
  StatusIncaricato,
  STATUS_LEVEL,
  ALL_STATUS,
  MAX_LIVELLI,
  BONUS_CAR_IMPORTO_EUR,
  SOGLIA_MINIMA_PAYOUT_EUR,
  Qualifica,
  IncaricatoMese,
  StornoRecord,
  ProvvigioneResult,
  PromozioneResult,
  BatchResult,
} from './types'

// ─── Utility ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function gvTotale(node: IncaricatoMese): number {
  return node.gvByLevel.reduce((s, v) => s + v, 0)
}

/**
 * Costruisce la mappa parentId → childIds dall'insieme di nodi.
 * Nodi con sponsor fuori dal batch (es. admin non incluso) vengono trattati come radici.
 */
function buildChildrenMap(nodes: Map<number, IncaricatoMese>): Map<number, number[]> {
  const children = new Map<number, number[]>()
  for (const node of nodes.values()) {
    if (node.sponsorId !== null && nodes.has(node.sponsorId)) {
      if (!children.has(node.sponsorId)) children.set(node.sponsorId, [])
      children.get(node.sponsorId)!.push(node.id)
    }
  }
  return children
}

/**
 * Ritorna i nodi radice del batch (sponsor null o sponsor fuori dal batch).
 */
function findRoots(nodes: Map<number, IncaricatoMese>): number[] {
  return Array.from(nodes.values())
    .filter(n => n.sponsorId === null || !nodes.has(n.sponsorId))
    .map(n => n.id)
}

// ─── Step 1: Applica storni ───────────────────────────────────────────────────

/**
 * Sottrae i PV stornati (resi del mese) da pvNetto e fatturatoPersonale.
 * I PV non possono scendere sotto zero.
 * Ritorna il numero di storni applicati.
 *
 * Fonte: doc 12 §1 — tabella storni_pv traccia storno per consulente/mese.
 */
export function applicaStorni(
  nodes: Map<number, IncaricatoMese>,
  storni: StornoRecord[]
): number {
  let count = 0
  for (const storno of storni) {
    const node = nodes.get(storno.incaricatoId)
    if (node === undefined) continue

    const riduzionePv = Math.min(storno.pvStornati, node.pvNetto)
    node.pvNetto -= riduzionePv

    // Il fatturato segue la stessa proporzione: storno PV ≈ storno fatturato
    // (assunzione: 1 PV ≈ 1€ prezzo consulente — da raffinare con conversione reale)
    node.fatturatoPersonale = Math.max(0, node.fatturatoPersonale - riduzionePv)
    count++
  }
  return count
}

// ─── Step 2: Consolida GV per livello (tree traversal post-order) ─────────────

/**
 * Percorre l'albero genealogico dal basso verso l'alto (DFS post-order).
 * Per ogni nodo popola gvByLevel[0..7]:
 *   gvByLevel[0] = PV somma dei figli diretti (L1)
 *   gvByLevel[1] = PV somma dei nipoti (L2) = sum(figli.gvByLevel[0])
 *   ...
 *   gvByLevel[k] = sum(figli.gvByLevel[k-1])
 *
 * Invariante dopo questa funzione:
 *   gvTotale(node) = Σ pvNetto di tutta la downline
 */
export function consolidaGvByLevel(nodes: Map<number, IncaricatoMese>): void {
  const children = buildChildrenMap(nodes)
  const roots = findRoots(nodes)

  // Inizializza array GV per tutti
  for (const node of nodes.values()) {
    node.gvByLevel = new Array(MAX_LIVELLI).fill(0)
  }

  const visited = new Set<number>()

  function dfs(id: number): void {
    if (visited.has(id)) return // guardia anti-cicli
    visited.add(id)

    const node = nodes.get(id)!
    const kids = children.get(id) ?? []

    // Prima processa tutti i figli (post-order)
    for (const kidId of kids) dfs(kidId)

    // Poi aggrega: il PV diretto del figlio va al mio L1,
    // il suo L1 va al mio L2, il suo L2 va al mio L3, ...
    for (const kidId of kids) {
      const kid = nodes.get(kidId)!
      node.gvByLevel[0] += kid.pvNetto
      for (let l = 0; l < MAX_LIVELLI - 1; l++) {
        node.gvByLevel[l + 1] += kid.gvByLevel[l]
      }
    }
  }

  for (const rootId of roots) dfs(rootId)
}

// ─── Step 3: Verifica attività mensile ───────────────────────────────────────

/**
 * Marca ogni incaricato come attivo o inattivo per il mese.
 *
 * Regola (doc 12 §3): inattivo se PV_mese < PV_richiesto_dal_proprio_status.
 * Il requisito GV si usa solo per le promozioni, non per l'attività mensile.
 *
 * Conseguenze dell'inattività (doc 02, regola 1):
 * - Provvigione personale: [DA DECIDERE] — qui implementata anche se inattivo
 *   perché ha comunque venduto (doc 12 §3 tabella, e suggerimento doc 12 §8 #4: SÌ)
 * - Reddito residuale, CAB, Bonus Car: NON percepiti
 */
export function checkAttivita(
  nodes: Map<number, IncaricatoMese>,
  qualifiche: Map<StatusIncaricato, Qualifica>
): void {
  for (const node of nodes.values()) {
    const q = qualifiche.get(node.status)!
    node.attivo = node.pvNetto >= q.pvMin
  }
}

// ─── Step 4: Verifica promozioni (irreversibili) ──────────────────────────────

/**
 * Per ogni incaricato verifica se soddisfa i requisiti dello status immediatamente
 * successivo al proprio statusMax corrente.
 *
 * Regole (doc 02 + doc 12 §4):
 * - Promozione sequenziale: un livello alla volta
 * - Irreversibile: statusMax non scende mai
 * - Intermezzo formativo: TEAM_COORDINATOR → MANAGER richiede formazione_completata=true
 * - I GV usati per la promozione sono quelli NETTI (dopo storni, step 1+2)
 *
 * NOTA (doc 12 §4 alternativa conservativa): le promozioni potrebbero essere
 * confermate solo a fine mese dopo consolidamento. Qui usiamo la logica in-mese
 * (più semplice, da rivalutare con Francesco).
 */
export function verificaPromozioni(
  nodes: Map<number, IncaricatoMese>,
  qualifiche: Map<StatusIncaricato, Qualifica>
): PromozioneResult[] {
  const promozioni: PromozioneResult[] = []

  for (const node of nodes.values()) {
    const currentMaxLevel = STATUS_LEVEL[node.statusMax]
    const nextStatus = ALL_STATUS[currentMaxLevel + 1] as StatusIncaricato | undefined
    if (!nextStatus) continue // già GOLDEN — massimo raggiunto

    const nextQ = qualifiche.get(nextStatus)!

    // Blocco intermezzo formativo (doc 02 §MANAGER)
    if (nextStatus === 'MANAGER' && !node.formazioneCompletata) continue

    const gvCorrente = gvTotale(node)
    if (node.pvNetto >= nextQ.pvMin && gvCorrente >= nextQ.gvMin) {
      const prev = node.statusMax
      node.status = nextStatus
      node.statusMax = nextStatus
      promozioni.push({
        incaricatoId: node.id,
        statusPrecedente: prev,
        nuovoStatus: nextStatus,
        nuovoStatusMax: nextStatus,
      })
    }
  }

  return promozioni
}

// ─── Step 5: Calcolo provvigioni complete + soglia payout ────────────────────

/**
 * Costruisce la mappa incaricatoId → incaricatiAttiviByLevel[0..7].
 * Usata per il CAB: conta consulenti attivi a ogni profondità dell'albero.
 * Richiede step 3 completato (node.attivo popolato).
 */
function buildAttiviByLevel(
  nodes: Map<number, IncaricatoMese>
): Map<number, number[]> {
  const children = buildChildrenMap(nodes)
  const roots = findRoots(nodes)

  const result = new Map<number, number[]>()
  for (const id of nodes.keys()) {
    result.set(id, new Array(MAX_LIVELLI).fill(0))
  }

  const visited = new Set<number>()

  function dfs(id: number): void {
    if (visited.has(id)) return
    visited.add(id)
    const kids = children.get(id) ?? []
    for (const kidId of kids) dfs(kidId)

    const myLevels = result.get(id)!
    for (const kidId of kids) {
      const kid = nodes.get(kidId)!
      myLevels[0] += kid.attivo ? 1 : 0
      const kidLevels = result.get(kidId)!
      for (let l = 0; l < MAX_LIVELLI - 1; l++) {
        myLevels[l + 1] += kidLevels[l]
      }
    }
  }

  for (const rootId of roots) dfs(rootId)
  return result
}

/**
 * Indice dell'ultimo livello con percentuale residuale > 0 (0-based).
 * DIRECTOR: [0.15, 0.15, 0.15, 0.15, 0.03, 0.02, 0, 0] → 5
 */
function maxLivelloConResiduale(qualifica: Qualifica): number {
  let max = -1
  for (let i = 0; i < qualifica.residualePerLivello.length; i++) {
    if (qualifica.residualePerLivello[i] > 0) max = i
  }
  return max
}

/**
 * Calcola tutte le componenti della provvigione per ogni consulente del mese.
 *
 * Step 5 del batch: richiede step 1-4 completati.
 *
 * @param globalPoolAllocazione  Quota Global Pool per Golden (calcolata annualmente
 *                               come 3% fatturato annuo ÷ N Golden attivi).
 *                               Passa 0 per tutti i mesi non di chiusura anno.
 */
export function calcolaProvvigioni(
  nodes: Map<number, IncaricatoMese>,
  qualifiche: Map<StatusIncaricato, Qualifica>,
  anno: number,
  mese: number,
  globalPoolAllocazione = 0
): ProvvigioneResult[] {
  const attiviByLevel = buildAttiviByLevel(nodes)

  return Array.from(nodes.values()).map(node => {
    const q = qualifiche.get(node.status)!
    const gvMese = gvTotale(node)

    // ── Provvigione personale: 15% × fatturato ───────────────────────────────
    // Pagata anche se inattivo (ha comunque venduto — doc 12 §8 #4)
    const provvigionePersonale = round2(q.provvigionePers * node.fatturatoPersonale)

    // ── Reddito residuale ────────────────────────────────────────────────────
    // Solo se attivo (doc 02 regola 1+4)
    let redditoResiduale = 0
    const residualeDettaglio: Record<string, number> = {}

    if (node.attivo) {
      for (let l = 0; l < MAX_LIVELLI; l++) {
        const pct = q.residualePerLivello[l]
        if (pct > 0 && node.gvByLevel[l] > 0) {
          const val = round2(pct * node.gvByLevel[l])
          residualeDettaglio[`l${l + 1}`] = val
          redditoResiduale += val
        }
      }
      redditoResiduale = round2(redditoResiduale)
    }

    // ── CAB ──────────────────────────────────────────────────────────────────
    // Solo DIRECTOR+ attivi. Conta consulenti attivi nei livelli di retribuzione.
    let cabBonus = 0
    if (node.attivo && q.cabImporto > 0) {
      const myAttiviLevels = attiviByLevel.get(node.id)!
      const ultimoLivello = maxLivelloConResiduale(q)
      let totalAttiviNeiLivelli = 0
      for (let l = 0; l <= ultimoLivello; l++) {
        totalAttiviNeiLivelli += myAttiviLevels[l]
      }
      cabBonus = round2(q.cabImporto * totalAttiviNeiLivelli)
    }

    // ── Bonus Car ────────────────────────────────────────────────────────────
    // Solo AMBASSADOR+ attivi (doc 02). Importo DA DECIDERE con FP.
    const bonusCar = node.attivo && q.haBonusCar ? BONUS_CAR_IMPORTO_EUR : 0

    // ── Global Pool ──────────────────────────────────────────────────────────
    // Solo GOLDEN attivi, calcolato annualmente (doc 02 §GLOBAL POOL)
    const globalPool = node.attivo && q.haGlobalPool ? round2(globalPoolAllocazione) : 0

    const totale = round2(
      provvigionePersonale + redditoResiduale + cabBonus + bonusCar + globalPool
    )

    return {
      incaricatoId: node.id,
      anno,
      mese,
      pvMese: node.pvNetto,
      gvMese,
      statusAlCalcolo: node.status,
      eraAttivo: node.attivo,
      provvigionePersonale,
      redditoResiduale,
      residualeDettaglio,
      cabBonus,
      bonusCar,
      globalPool,
      totale,
      daAccumulare: totale < SOGLIA_MINIMA_PAYOUT_EUR,
    }
  })
}

// ─── Orchestratore (versione in-memory, senza DB) ────────────────────────────

/**
 * Esegue i 6 step del batch mensile nell'ordine prescritto (doc 12 §9).
 * Versione pura: accetta dati già caricati, ritorna risultati senza toccare il DB.
 *
 * Per il flow completo con persistenza su DB usare `calcolaProvvigioniMensili`
 * in `index.ts`.
 */
export function eseguiBatch(
  nodes: Map<number, IncaricatoMese>,
  storni: StornoRecord[],
  qualifiche: Map<StatusIncaricato, Qualifica>,
  anno: number,
  mese: number,
  globalPoolAllocazione = 0
): BatchResult {
  // 1. Storni
  const storniApplicati = applicaStorni(nodes, storni)

  // 2. Consolida GV
  consolidaGvByLevel(nodes)

  // 3. Attività
  checkAttivita(nodes, qualifiche)

  // 4. Promozioni
  const promozioni = verificaPromozioni(nodes, qualifiche)

  // 5+6. Calcola provvigioni + soglia payout
  const provvigioni = calcolaProvvigioni(nodes, qualifiche, anno, mese, globalPoolAllocazione)

  const attivi = provvigioni.filter(p => p.eraAttivo).length
  const totaleLordo = round2(provvigioni.reduce((s, p) => s + p.totale, 0))
  const totalePayout = round2(
    provvigioni.filter(p => !p.daAccumulare).reduce((s, p) => s + p.totale, 0)
  )

  return {
    anno,
    mese,
    provvigioni,
    promozioni,
    storniApplicati,
    incaricatiAttivi: attivi,
    incaricatiInattivi: provvigioni.length - attivi,
    totaleLordo,
    totalePayout,
  }
}
