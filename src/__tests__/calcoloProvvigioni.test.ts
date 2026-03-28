// =============================================================================
// Test: servizio calcolo provvigioni mensili
//
// Scenari coperti:
//   A. Albero seed (5 consulenti, 3 livelli) — tree traversal + valori attesi
//   B. Storno PV — consulente che diventa inattivo dopo lo storno
//   C. Promozione — rilevamento e applicazione status_max
//   D. Intermezzo formativo — blocco promozione a MANAGER senza formazione
//   E. Albero con nodo inattivo — CAB esclude gli inattivi
//   F. Soglia minima payout — accumulazione sotto 10€
//   G. Global Pool — distribuzione solo ai Golden attivi
// =============================================================================

import {
  applicaStorni,
  consolidaGvByLevel,
  checkAttivita,
  verificaPromozioni,
  calcolaProvvigioni,
  eseguiBatch,
} from '../jobs/calcoloProvvigioni/engine'
import {
  ConsulenteMese,
  Qualifica,
  StatusConsulente,
  StornoRecord,
  SOGLIA_MINIMA_PAYOUT_EUR,
  BONUS_CAR_IMPORTO_EUR,
} from '../jobs/calcoloProvvigioni/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeNode(
  id: number,
  sponsorId: number | null,
  status: StatusConsulente,
  pvNetto: number,
  overrides: Partial<ConsulenteMese> = {}
): ConsulenteMese {
  return {
    id,
    sponsorId,
    status,
    statusMax: status,
    formazioneCompletata: false,
    pvLordo: pvNetto,
    pvNetto,
    fatturatoPersonale: pvNetto, // 1 PV ≈ 1€ nei test
    gvByLevel: [],
    attivo: false,
    ...overrides,
  }
}

function makeMap(nodes: ConsulenteMese[]): Map<number, ConsulenteMese> {
  return new Map(nodes.map(n => [n.id, n]))
}

/** Qualifiche esatte dal seed DB (doc 02). */
function buildQualifiche(): Map<StatusConsulente, Qualifica> {
  const defs: Qualifica[] = [
    {
      status: 'STARTER',
      pvMin: 0, gvMin: 0,
      provvigionePers: 0.15,
      residualePerLivello: [0, 0, 0, 0, 0, 0, 0, 0],
      cabImporto: 0, haBonusCar: false, haGlobalPool: false,
    },
    {
      status: 'APPRENTICE',
      pvMin: 50, gvMin: 50,
      provvigionePers: 0.15,
      residualePerLivello: [0.60, 0, 0, 0, 0, 0, 0, 0],
      cabImporto: 0, haBonusCar: false, haGlobalPool: false,
    },
    {
      status: 'ADVISOR',
      pvMin: 50, gvMin: 150,
      provvigionePers: 0.15,
      residualePerLivello: [0.30, 0.30, 0, 0, 0, 0, 0, 0],
      cabImporto: 0, haBonusCar: false, haGlobalPool: false,
    },
    {
      status: 'SUPERVISOR',
      pvMin: 50, gvMin: 500,
      provvigionePers: 0.15,
      residualePerLivello: [0.20, 0.20, 0.20, 0, 0, 0, 0, 0],
      cabImporto: 0, haBonusCar: false, haGlobalPool: false,
    },
    {
      status: 'TEAM_COORDINATOR',
      pvMin: 50, gvMin: 1500,
      provvigionePers: 0.15,
      residualePerLivello: [0.15, 0.15, 0.15, 0.15, 0, 0, 0, 0],
      cabImporto: 0, haBonusCar: false, haGlobalPool: false,
    },
    {
      status: 'MANAGER',
      pvMin: 80, gvMin: 15000,
      provvigionePers: 0.15,
      residualePerLivello: [0.15, 0.15, 0.15, 0.15, 0.03, 0, 0, 0],
      cabImporto: 0, haBonusCar: false, haGlobalPool: false,
    },
    {
      status: 'DIRECTOR',
      pvMin: 100, gvMin: 50000,
      provvigionePers: 0.15,
      residualePerLivello: [0.15, 0.15, 0.15, 0.15, 0.03, 0.02, 0, 0],
      cabImporto: 1.00, haBonusCar: false, haGlobalPool: false,
    },
    {
      status: 'AMBASSADOR',
      pvMin: 120, gvMin: 100000,
      provvigionePers: 0.15,
      residualePerLivello: [0.15, 0.15, 0.15, 0.15, 0.03, 0.02, 0.01, 0],
      cabImporto: 2.00, haBonusCar: true, haGlobalPool: false,
    },
    {
      status: 'GOLDEN',
      pvMin: 150, gvMin: 100000,
      provvigionePers: 0.15,
      residualePerLivello: [0.15, 0.15, 0.15, 0.15, 0.03, 0.02, 0.01, 0.01],
      cabImporto: 3.00, haBonusCar: true, haGlobalPool: true,
    },
  ]
  return new Map(defs.map(q => [q.status, q]))
}

const Q = buildQualifiche()

// ─── Fixture: albero seed (5 consulenti, come da db/schema.sql) ───────────────
//
//  Francesco (1) DIRECTOR — pv=102, sponsor=null
//  ├── Giulia    (2) SUPERVISOR — pv=68,  sponsor=1
//  │   └── Luca (3) ADVISOR    — pv=55,  sponsor=2
//  │       └── Marta (4) APPRENTICE — pv=52, sponsor=3
//  └── Roberto  (5) STARTER   — pv=18,  sponsor=1

function buildSeedNodes(): Map<number, ConsulenteMese> {
  return makeMap([
    makeNode(1, null, 'DIRECTOR',   102, { formazioneCompletata: true }),
    makeNode(2, 1,    'SUPERVISOR',  68),
    makeNode(3, 2,    'ADVISOR',     55),
    makeNode(4, 3,    'APPRENTICE',  52),
    makeNode(5, 1,    'STARTER',     18),
  ])
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO A: albero seed completo
// ─────────────────────────────────────────────────────────────────────────────

describe('A — Albero seed: tree traversal e GV', () => {
  let nodes: Map<number, ConsulenteMese>

  beforeEach(() => {
    nodes = buildSeedNodes()
    consolidaGvByLevel(nodes)
  })

  test('Marta (foglia): gvByLevel tutti zero', () => {
    const marta = nodes.get(4)!
    expect(marta.gvByLevel).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })

  test('Roberto (foglia): gvByLevel tutti zero', () => {
    expect(nodes.get(5)!.gvByLevel).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })

  test('Luca (L1=Marta=52): gvByLevel[0]=52, resto zero', () => {
    const luca = nodes.get(3)!
    expect(luca.gvByLevel[0]).toBe(52)
    expect(luca.gvByLevel.slice(1)).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  test('Giulia (L1=Luca=55, L2=Marta=52): gvByLevel[0..1]=[55,52]', () => {
    const giulia = nodes.get(2)!
    expect(giulia.gvByLevel[0]).toBe(55)
    expect(giulia.gvByLevel[1]).toBe(52)
    expect(giulia.gvByLevel.slice(2)).toEqual([0, 0, 0, 0, 0, 0])
  })

  test('Francesco: L1=Giulia(68)+Roberto(18)=86, L2=Luca(55), L3=Marta(52)', () => {
    const f = nodes.get(1)!
    expect(f.gvByLevel[0]).toBe(86)  // Giulia + Roberto
    expect(f.gvByLevel[1]).toBe(55)  // Luca
    expect(f.gvByLevel[2]).toBe(52)  // Marta
    expect(f.gvByLevel.slice(3)).toEqual([0, 0, 0, 0, 0])
  })

  test('gvTotale Francesco = 86+55+52 = 193', () => {
    const f = nodes.get(1)!
    const total = f.gvByLevel.reduce((s, v) => s + v, 0)
    expect(total).toBe(193)
  })
})

describe('A — Albero seed: attività', () => {
  let nodes: Map<number, ConsulenteMese>

  beforeEach(() => {
    nodes = buildSeedNodes()
    consolidaGvByLevel(nodes)
    checkAttivita(nodes, Q)
  })

  test('tutti e 5 i consulenti sono attivi (PV >= pvMin del loro status)', () => {
    // DIRECTOR(100), SUPERVISOR(50), ADVISOR(50), APPRENTICE(50), STARTER(0)
    for (const node of nodes.values()) {
      expect(node.attivo).toBe(true)
    }
  })
})

describe('A — Albero seed: provvigioni', () => {
  let result: ReturnType<typeof eseguiBatch>

  beforeEach(() => {
    result = eseguiBatch(buildSeedNodes(), [], Q, 2026, 3)
  })

  const byId = (id: number) =>
    (r: ReturnType<typeof eseguiBatch>) => r.provvigioni.find(p => p.consulenteId === id)!

  test('Francesco (DIRECTOR): provvigionePersonale = 0.15 × 102 = 15.30', () => {
    expect(byId(1)(result).provvigionePersonale).toBe(15.30)
  })

  test('Francesco: residuale L1=0.15×86=12.90, L2=0.15×55=8.25, L3=0.15×52=7.80', () => {
    const p = byId(1)(result)
    expect(p.residualeDettaglio.l1).toBe(12.90)
    expect(p.residualeDettaglio.l2).toBe(8.25)
    expect(p.residualeDettaglio.l3).toBe(7.80)
    expect(p.redditoResiduale).toBe(28.95)
  })

  test('Francesco: CAB = 4 attivi (Giulia+Roberto=2 a L1, Luca=1 a L2, Marta=1 a L3) × 1€ = 4€', () => {
    expect(byId(1)(result).cabBonus).toBe(4.00)
  })

  test('Francesco: totale = 15.30 + 28.95 + 4.00 = 48.25', () => {
    expect(byId(1)(result).totale).toBe(48.25)
  })

  test('Giulia (SUPERVISOR): provv=10.20, residuale L1=0.20×55=11, L2=0.20×52=10.40 → 21.40, totale=31.60', () => {
    const p = byId(2)(result)
    expect(p.provvigionePersonale).toBe(10.20)
    expect(p.residualeDettaglio.l1).toBe(11.00)
    expect(p.residualeDettaglio.l2).toBe(10.40)
    expect(p.redditoResiduale).toBe(21.40)
    expect(p.totale).toBe(31.60)
  })

  test('Luca (ADVISOR): provv=8.25, residuale L1=0.30×52=15.60, totale=23.85', () => {
    const p = byId(2)(result)
    // Luca specifico
    const luca = result.provvigioni.find(p => p.consulenteId === 3)!
    expect(luca.provvigionePersonale).toBe(8.25)
    expect(luca.residualeDettaglio.l1).toBe(15.60)
    expect(luca.totale).toBe(23.85)
  })

  test('Marta (APPRENTICE): gvByLevel=[0,...], residuale=0, totale=7.80 < 10 → daAccumulare', () => {
    const marta = result.provvigioni.find(p => p.consulenteId === 4)!
    expect(marta.redditoResiduale).toBe(0)
    expect(marta.totale).toBe(7.80)
    expect(marta.daAccumulare).toBe(true)
  })

  test('Roberto (STARTER): totale=2.70 → daAccumulare', () => {
    const roberto = result.provvigioni.find(p => p.consulenteId === 5)!
    expect(roberto.totale).toBe(2.70)
    expect(roberto.daAccumulare).toBe(true)
  })

  test('BatchResult: 5 attivi, 0 inattivi', () => {
    expect(result.consulentiAttivi).toBe(5)
    expect(result.consulentiInattivi).toBe(0)
  })

  test('BatchResult: totaleLordo = 48.25+31.60+23.85+7.80+2.70 = 114.20', () => {
    expect(result.totaleLordo).toBe(114.20)
  })

  test('BatchResult: totalePayout = 48.25+31.60+23.85 = 103.70 (escluse Marta e Roberto)', () => {
    expect(result.totalePayout).toBe(103.70)
  })

  test('nessuna promozione nel mese di riferimento (GV insufficienti per tutti)', () => {
    expect(result.promozioni).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO B: Storno PV
// ─────────────────────────────────────────────────────────────────────────────

describe('B — Storno PV', () => {
  test('storno parziale: pvNetto diminuisce senza andare sotto zero', () => {
    const nodes = makeMap([makeNode(10, null, 'ADVISOR', 60)])
    const storni: StornoRecord[] = [{ consulenteId: 10, pvStornati: 15 }]

    const count = applicaStorni(nodes, storni)

    expect(count).toBe(1)
    expect(nodes.get(10)!.pvNetto).toBe(45)
    expect(nodes.get(10)!.fatturatoPersonale).toBe(45)
  })

  test('storno eccedente: pvNetto si azzera, non va negativo', () => {
    const nodes = makeMap([makeNode(10, null, 'ADVISOR', 30)])
    applicaStorni(nodes, [{ consulenteId: 10, pvStornati: 50 }])
    expect(nodes.get(10)!.pvNetto).toBe(0)
    expect(nodes.get(10)!.fatturatoPersonale).toBe(0)
  })

  test('storno rende inattivo un APPRENTICE (pvNetto scende sotto pvMin=50)', () => {
    //
    // APPRENTICE con 60 PV lordi. Storno di 15 → pvNetto=45 < pvMin(50).
    //
    const nodes = makeMap([makeNode(20, null, 'APPRENTICE', 60)])
    const storni: StornoRecord[] = [{ consulenteId: 20, pvStornati: 15 }]

    applicaStorni(nodes, storni)
    consolidaGvByLevel(nodes)
    checkAttivita(nodes, Q)

    const node = nodes.get(20)!
    expect(node.pvNetto).toBe(45)
    expect(node.attivo).toBe(false)
  })

  test('inattivo dopo storno: zero residuale e zero CAB, ma provvigione personale pagata (doc 12 §8 #4)', () => {
    //
    // Regola: la provvigione personale si paga sempre (ha comunque venduto).
    // Solo reddito residuale e bonus sono bloccati dall'inattività.
    //
    const nodes = makeMap([
      makeNode(20, null,  'APPRENTICE', 60),
      makeNode(21, 20,    'STARTER',    30),  // downline che genera GV
    ])
    const storni: StornoRecord[] = [{ consulenteId: 20, pvStornati: 15 }]

    const result = eseguiBatch(nodes, storni, Q, 2026, 3)
    const prov = result.provvigioni.find(p => p.consulenteId === 20)!

    expect(prov.eraAttivo).toBe(false)
    expect(prov.provvigionePersonale).toBe(6.75)  // 0.15 × 45
    expect(prov.redditoResiduale).toBe(0)          // inattivo → no residuale
  })

  test('storno su consulente non nel batch viene ignorato silenziosamente', () => {
    const nodes = makeMap([makeNode(30, null, 'ADVISOR', 60)])
    const count = applicaStorni(nodes, [{ consulenteId: 999, pvStornati: 10 }])
    expect(count).toBe(0)
    expect(nodes.get(30)!.pvNetto).toBe(60)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO C: Promozioni
// ─────────────────────────────────────────────────────────────────────────────

describe('C — Promozioni', () => {
  test('ADVISOR → SUPERVISOR: promozione rilevata se GV >= 500', () => {
    //
    // ADVISOR ha pvNetto=55 e una downline di 10 STARTER × 60 PV = 600 GV.
    // SUPERVISOR richiede PV>=50 (✓) e GV>=500 (✓).
    //
    const nodes = makeMap([
      makeNode(40, null, 'ADVISOR', 55),
      ...Array.from({ length: 10 }, (_, i) =>
        makeNode(100 + i, 40, 'STARTER', 60)
      ),
    ])

    consolidaGvByLevel(nodes)
    checkAttivita(nodes, Q)
    const promozioni = verificaPromozioni(nodes, Q)

    expect(promozioni).toHaveLength(1)
    expect(promozioni[0].consulenteId).toBe(40)
    expect(promozioni[0].statusPrecedente).toBe('ADVISOR')
    expect(promozioni[0].nuovoStatus).toBe('SUPERVISOR')
    expect(nodes.get(40)!.status).toBe('SUPERVISOR')
    expect(nodes.get(40)!.statusMax).toBe('SUPERVISOR')
  })

  test('promozione sequenziale: salta un solo livello alla volta', () => {
    //
    // Un APPRENTICE con GV=600 soddisfa i requisiti di ADVISOR (GV>=150)
    // ma non di SUPERVISOR (GV>=500). Deve promuoversi solo ad ADVISOR.
    //
    // (GV=600 soddisferebbe anche SUPERVISOR se non fosse sequenziale,
    //  ma la logica controlla solo il livello immediatamente successivo.)
    //
    const nodes = makeMap([
      makeNode(50, null, 'APPRENTICE', 55),
      ...Array.from({ length: 10 }, (_, i) =>
        makeNode(200 + i, 50, 'STARTER', 60)
      ),
    ])

    consolidaGvByLevel(nodes)
    checkAttivita(nodes, Q)
    const promozioni = verificaPromozioni(nodes, Q)

    expect(promozioni).toHaveLength(1)
    expect(promozioni[0].nuovoStatus).toBe('ADVISOR')
  })

  test('GOLDEN: nessuna promozione ulteriore (tetto massimo)', () => {
    const nodes = makeMap([
      makeNode(60, null, 'GOLDEN', 200, { formazioneCompletata: true }),
    ])
    consolidaGvByLevel(nodes)
    checkAttivita(nodes, Q)
    const promozioni = verificaPromozioni(nodes, Q)
    expect(promozioni).toHaveLength(0)
  })

  test('GV insufficiente: nessuna promozione', () => {
    //
    // ADVISOR con GV=120 < 500 → non diventa SUPERVISOR.
    //
    const nodes = makeMap([
      makeNode(70, null, 'ADVISOR', 55),
      makeNode(71, 70,   'STARTER', 120),
    ])
    consolidaGvByLevel(nodes)
    checkAttivita(nodes, Q)
    const promozioni = verificaPromozioni(nodes, Q)
    expect(promozioni).toHaveLength(0)
  })

  test('la promozione aggiorna sia status che statusMax sul nodo', () => {
    const nodes = makeMap([
      makeNode(80, null, 'STARTER', 60),
      makeNode(81, 80,   'STARTER', 60),  // GV=60 >= 50 → APPRENTICE
    ])
    consolidaGvByLevel(nodes)
    checkAttivita(nodes, Q)
    verificaPromozioni(nodes, Q)

    const node = nodes.get(80)!
    expect(node.status).toBe('APPRENTICE')
    expect(node.statusMax).toBe('APPRENTICE')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO D: Intermezzo formativo TEAM_COORDINATOR → MANAGER
// ─────────────────────────────────────────────────────────────────────────────

describe('D — Intermezzo formativo', () => {
  function buildTCWithBigDownline(formazione: boolean): Map<number, ConsulenteMese> {
    // TEAM_COORDINATOR con downline da 200 STARTER × 100 PV = 20.000 GV.
    // MANAGER richiede GV>=15.000. Senza formazione: bloccato.
    return makeMap([
      makeNode(90, null, 'TEAM_COORDINATOR', 90, { formazioneCompletata: formazione }),
      ...Array.from({ length: 200 }, (_, i) =>
        makeNode(300 + i, 90, 'STARTER', 100)
      ),
    ])
  }

  test('formazione=false: promozione a MANAGER bloccata nonostante GV sufficienti', () => {
    const nodes = buildTCWithBigDownline(false)
    consolidaGvByLevel(nodes)
    checkAttivita(nodes, Q)
    const promozioni = verificaPromozioni(nodes, Q)
    expect(promozioni).toHaveLength(0)
    expect(nodes.get(90)!.status).toBe('TEAM_COORDINATOR')
  })

  test('formazione=true: promozione a MANAGER sbloccata', () => {
    const nodes = buildTCWithBigDownline(true)
    consolidaGvByLevel(nodes)
    checkAttivita(nodes, Q)
    const promozioni = verificaPromozioni(nodes, Q)

    expect(promozioni).toHaveLength(1)
    expect(promozioni[0].nuovoStatus).toBe('MANAGER')
    expect(nodes.get(90)!.status).toBe('MANAGER')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO E: CAB con nodi inattivi
// ─────────────────────────────────────────────────────────────────────────────

describe('E — CAB: conta solo consulenti attivi', () => {
  test('CAB esclude i consulenti inattivi dal conteggio', () => {
    //
    // Struttura: Director (pv=105) con 3 diretti (L1):
    //   - Alpha: ADVISOR pv=55 → attivo
    //   - Beta:  ADVISOR pv=20 → inattivo (pvMin ADVISOR=50, 20<50)
    //   - Gamma: ADVISOR pv=55 → attivo
    //
    // CAB = 2 attivi × 1€ = 2€ (non 3€)
    //
    const nodes = makeMap([
      makeNode(1, null, 'DIRECTOR', 105),
      makeNode(2, 1, 'ADVISOR', 55),   // attivo
      makeNode(3, 1, 'ADVISOR', 20),   // inattivo (20 < pvMin=50)
      makeNode(4, 1, 'ADVISOR', 55),   // attivo
    ])

    const result = eseguiBatch(nodes, [], Q, 2026, 3)
    const director = result.provvigioni.find(p => p.consulenteId === 1)!

    expect(director.eraAttivo).toBe(true)
    expect(director.cabBonus).toBe(2.00)
  })

  test('CAB=0 se DIRECTOR è lui stesso inattivo', () => {
    // Director con PV=90 < pvMin=100 → inattivo → no CAB
    const nodes = makeMap([
      makeNode(1, null, 'DIRECTOR', 90),
      makeNode(2, 1, 'STARTER', 50),
    ])
    const result = eseguiBatch(nodes, [], Q, 2026, 3)
    expect(result.provvigioni.find(p => p.consulenteId === 1)!.cabBonus).toBe(0)
  })

  test('CAB multi-livello: conta attivi in tutti i livelli di retribuzione', () => {
    //
    // Director (pv=110) con struttura:
    //   L1: A (Supervisor, attivo pv=60), B (Supervisor, attivo pv=60)
    //   L2: C (Advisor, attivo pv=55) — figlio di A
    //   L3: D (Starter, attivo pv=10) — figlio di C
    //
    // Livelli di retribuzione Director: L1-L6.
    // Attivi nei livelli: A(L1) + B(L1) + C(L2) + D(L3) = 4
    // CAB = 4 × 1€ = 4€
    //
    const nodes = makeMap([
      makeNode(1, null, 'DIRECTOR',    110),
      makeNode(2, 1,    'SUPERVISOR',   60),
      makeNode(3, 1,    'SUPERVISOR',   60),
      makeNode(4, 2,    'ADVISOR',       55),
      makeNode(5, 4,    'STARTER',       10),
    ])
    const result = eseguiBatch(nodes, [], Q, 2026, 3)
    expect(result.provvigioni.find(p => p.consulenteId === 1)!.cabBonus).toBe(4.00)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO F: Soglia minima payout
// ─────────────────────────────────────────────────────────────────────────────

describe('F — Soglia minima payout', () => {
  test(`provvigione < ${SOGLIA_MINIMA_PAYOUT_EUR}€ → daAccumulare=true`, () => {
    const nodes = makeMap([makeNode(10, null, 'STARTER', 50)])
    const result = eseguiBatch(nodes, [], Q, 2026, 3)
    const p = result.provvigioni[0]
    expect(p.totale).toBe(7.50)  // 0.15 × 50
    expect(p.totale).toBeLessThan(SOGLIA_MINIMA_PAYOUT_EUR)
    expect(p.daAccumulare).toBe(true)
  })

  test(`provvigione >= ${SOGLIA_MINIMA_PAYOUT_EUR}€ → daAccumulare=false`, () => {
    const nodes = makeMap([makeNode(10, null, 'STARTER', 100)])
    const result = eseguiBatch(nodes, [], Q, 2026, 3)
    const p = result.provvigioni[0]
    expect(p.totale).toBe(15.00)
    expect(p.daAccumulare).toBe(false)
  })

  test('totalePayout esclude le provvigioni sotto soglia', () => {
    const nodes = makeMap([
      makeNode(1, null, 'STARTER', 200),  // 0.15×200=30 → paga
      makeNode(2, null, 'STARTER',  40),  // 0.15×40=6  → accumula
    ])
    const result = eseguiBatch(nodes, [], Q, 2026, 3)
    expect(result.totaleLordo).toBe(36.00)
    expect(result.totalePayout).toBe(30.00)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO G: Global Pool
// ─────────────────────────────────────────────────────────────────────────────

describe('G — Global Pool', () => {
  test('Global Pool assegnato solo ai Golden attivi', () => {
    //
    // 2 Golden attivi. Il pool allocato per uno è 500€.
    // L'Ambassador non partecipa al Global Pool.
    //
    const nodes = makeMap([
      makeNode(1, null,  'GOLDEN',      160),   // attivo (pv>=150)
      makeNode(2, 1,     'GOLDEN',      155),   // attivo
      makeNode(3, 2,     'AMBASSADOR',  125),   // attivo ma no pool
    ])

    consolidaGvByLevel(nodes)
    checkAttivita(nodes, Q)
    const provvigioni = calcolaProvvigioni(nodes, Q, 2026, 12, 500)

    const g1 = provvigioni.find(p => p.consulenteId === 1)!
    const g2 = provvigioni.find(p => p.consulenteId === 2)!
    const amb = provvigioni.find(p => p.consulenteId === 3)!

    expect(g1.globalPool).toBe(500)
    expect(g2.globalPool).toBe(500)
    expect(amb.globalPool).toBe(0)
  })

  test('Golden inattivo non riceve il Global Pool', () => {
    const nodes = makeMap([
      makeNode(1, null, 'GOLDEN', 100),  // inattivo: pv=100 < pvMin=150
    ])
    consolidaGvByLevel(nodes)
    checkAttivita(nodes, Q)
    const provvigioni = calcolaProvvigioni(nodes, Q, 2026, 12, 1000)
    expect(provvigioni[0].globalPool).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO: Bonus Car
// ─────────────────────────────────────────────────────────────────────────────

describe('Bonus Car', () => {
  test(`Ambassador attivo riceve Bonus Car di ${BONUS_CAR_IMPORTO_EUR}€`, () => {
    const nodes = makeMap([makeNode(1, null, 'AMBASSADOR', 125)])
    consolidaGvByLevel(nodes)
    checkAttivita(nodes, Q)
    const provvigioni = calcolaProvvigioni(nodes, Q, 2026, 3)
    expect(provvigioni[0].bonusCar).toBe(BONUS_CAR_IMPORTO_EUR)
  })

  test('Ambassador inattivo non riceve Bonus Car', () => {
    const nodes = makeMap([makeNode(1, null, 'AMBASSADOR', 110)]) // pv=110 < pvMin=120
    consolidaGvByLevel(nodes)
    checkAttivita(nodes, Q)
    const provvigioni = calcolaProvvigioni(nodes, Q, 2026, 3)
    expect(provvigioni[0].bonusCar).toBe(0)
  })

  test('Director non ha Bonus Car', () => {
    const nodes = makeMap([makeNode(1, null, 'DIRECTOR', 105)])
    consolidaGvByLevel(nodes)
    checkAttivita(nodes, Q)
    const provvigioni = calcolaProvvigioni(nodes, Q, 2026, 3)
    expect(provvigioni[0].bonusCar).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO: idempotenza e casi limite
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  test('batch con nessun consulente ritorna risultato vuoto', () => {
    const result = eseguiBatch(new Map(), [], Q, 2026, 3)
    expect(result.provvigioni).toHaveLength(0)
    expect(result.totaleLordo).toBe(0)
  })

  test('batch con nessun ordine (tutti PV=0): tutti inattivi tranne STARTER', () => {
    //
    // STARTER ha pvMin=0 → attivo anche con PV=0.
    // APPRENTICE ha pvMin=50 → inattivo con PV=0.
    //
    const nodes = makeMap([
      makeNode(1, null, 'STARTER',    0),
      makeNode(2, null, 'APPRENTICE', 0),
    ])
    const result = eseguiBatch(nodes, [], Q, 2026, 3)

    const starter    = result.provvigioni.find(p => p.consulenteId === 1)!
    const apprentice = result.provvigioni.find(p => p.consulenteId === 2)!

    expect(starter.eraAttivo).toBe(true)
    expect(apprentice.eraAttivo).toBe(false)
    expect(result.totaleLordo).toBe(0)
  })

  test('la funzione consolidaGvByLevel è idempotente se chiamata due volte', () => {
    const nodes = buildSeedNodes()
    consolidaGvByLevel(nodes)
    const gvPrimaChiamata = { ...nodes.get(1)!.gvByLevel }

    // Reinizializza e richiama
    for (const n of nodes.values()) n.gvByLevel = []
    consolidaGvByLevel(nodes)

    expect(nodes.get(1)!.gvByLevel).toEqual(Object.values(gvPrimaChiamata))
  })

  test('nodo con sponsor fuori dal batch viene trattato come radice', () => {
    //
    // Simula un consulente il cui sponsor è cancellato/fuori dal batch.
    // Deve funzionare come una radice senza crashare.
    //
    const nodes = makeMap([
      makeNode(1, 9999, 'ADVISOR', 55),  // sponsor 9999 non nel batch
      makeNode(2, 1,    'STARTER', 30),
    ])
    expect(() => {
      consolidaGvByLevel(nodes)
      checkAttivita(nodes, Q)
    }).not.toThrow()

    expect(nodes.get(1)!.gvByLevel[0]).toBe(30)
  })
})
