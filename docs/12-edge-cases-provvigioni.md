# 12 — Edge Cases e Regole Business Limite

> Questo documento copre tutto ciò che il piano compensi ufficiale NON dice
> esplicitamente ma che il sistema DEVE gestire. Senza queste regole, il primo
> reso o il primo consulente inattivo rompono i calcoli.
>
> ⚠ Molte di queste regole DEVONO essere validate con Francesco/team legale.
> Dove manca una decisione, è indicato come [DA DECIDERE].

---

## 1. RESI E STORNI

### Scenario: un cliente restituisce un ordine dopo il pagamento

**Domanda chiave:** I PV generati da quell'ordine vengono stornati?

**Regola proposta:**
```
SE reso entro 14 giorni (diritto di recesso):
  → PV dell'ordine vengono STORNATI dal mese in cui è avvenuto il reso
  → GV della catena upline vengono ricalcolati
  → Se il consulente era diventato "attivo" o aveva ottenuto una promozione
    GRAZIE a quei PV → vedi sezione "Promozione basata su PV poi stornati"
  → Provvigioni già pagate su quell'ordine → vengono detratte dal mese successivo

SE reso dopo 14 giorni (goodwill, prodotto difettoso):
  → [DA DECIDERE] Storno PV o no?
  → Suggerimento: stornare PV solo se reso totale. Sostituzione prodotto = no storno.
```

**Impatto sul sistema:**
- Tabella `storni_pv` che traccia: ordine originale, data storno, PV stornati, consulente, mese di competenza
- Il calcolo provvigioni mensile deve controllare gli storni prima di consolidare
- L'albero GV deve essere ricalcolabile retroattivamente (almeno per il mese corrente)

### Scenario: ordine annullato prima della spedizione

```
Ordine annullato prima della spedizione → MAI genera PV
Il sistema non dovrebbe contare PV fino a stato ordine = PAGATO (o SPEDITO?)
```

**[DA DECIDERE]:** PV si generano al pagamento o alla consegna confermata?
- Al pagamento: più semplice, il consulente vede i PV subito
- Alla consegna: più sicuro contro frodi/annullamenti, ma esperienza peggiore

---

## 2. PROMOZIONE E STATUS

### Regola base (dal Compensation Plan)
> Una volta raggiunto uno Status, si mantiene per sempre.

### Edge case: promozione basata su PV poi stornati

**Scenario:** Il consulente raggiunge 50 PV (diventa Apprentice) il 15 del mese.
Il 28 del mese, un ordine da 20 PV viene reso. PV effettivi fine mese: 30.

**Regola proposta:**
```
SE la promozione è già stata registrata E i PV dopo storno scendono sotto la soglia:
  → La promozione NON viene revocata (coerente con "non retrocedere mai")
  → MA: il consulente potrebbe non essere "attivo" quel mese (PV sotto requisito)
  → QUINDI: non percepisce provvigioni/reddito residuale quel mese
  → Lo status resta, i guadagni no
```

**Alternativa più conservativa [DA DECIDERE]:**
Le promozioni vengono confermate solo a FINE MESE dopo il consolidamento degli storni.
Durante il mese il consulente vede "status provvisorio" o "in fase di qualificazione".

### Edge case: consulente raggiunge Golden e poi non è mai più attivo

```
Status: GOLDEN (150 PV richiesti/mese)
Ma il consulente non vende più nulla.

→ Status resta GOLDEN per sempre
→ Ma zero provvigioni/bonus perché non è "attivo"
→ Nel backoffice: mostrare "GOLDEN (inattivo)" con distinzione visiva chiara
→ Il suo team continua a funzionare: i suoi diretti hanno ancora il loro sponsor,
  l'albero genealogico non cambia
```

---

## 3. INATTIVITÀ

### Definizione di "inattivo"

```
Un consulente è INATTIVO in un dato mese se:
  PV_mese < PV_richiesto_dal_suo_status

Esempio: un Advisor (richiede 50 PV) che fa 30 PV → inattivo quel mese
```

### Conseguenze dell'inattività

| Aspetto | Cosa succede |
|---------|-------------|
| Status | NON cambia (non retrocede) |
| Provvigione personale | Percepisce comunque il 15% sulle vendite fatte (ha venduto per 30 PV) [DA DECIDERE] |
| Reddito residuale | NON percepito per quel mese |
| Bonus CAB | NON percepito |
| Bonus Car | NON percepito |
| Global Pool | NON partecipa per quel mese |
| Albero team | Resta intatto, i suoi diretti lo hanno ancora come sponsor |
| GV per l'upline | I PV del consulente inattivo contano COMUNQUE come GV per il suo sponsor? [DA DECIDERE] |

**[DA DECIDERE] Punto critico:** Se un consulente è inattivo, i PV che ha comunque fatto
(es. 30 su 50 richiesti) entrano nei GV del suo upline? Due opzioni:
- **Sì:** più generoso, l'upline non viene penalizzato per l'inattività del downstream
- **No:** più rigoroso, incentiva l'upline a motivare il team

### Inattività prolungata

```
SE consulente inattivo per 3 mesi consecutivi:
  → [DA DECIDERE] Notifica automatica? Email di re-engagement?
  → Suggerimento: sequenza automatica (mese 1: reminder, mese 2: offerta, mese 3: contatto sponsor)

SE consulente inattivo per 12+ mesi:
  → [DA DECIDERE] Sospensione account? Archivio? O resta attivo indefinitamente?
  → Suggerimento: stato "DORMIENTE" visibile in backoffice, non rimosso dall'albero
```

---

## 4. RECLUTAMENTO E ALBERO

### Edge case: lo sponsor lascia l'attività

**Scenario:** Il consulente A sponsorizza B, C, D. Poi A diventa dormiente/inattivo per 12 mesi.

```
→ B, C, D restano nell'albero sotto A
→ A resta come nodo nell'albero (non viene rimosso)
→ Se A è inattivo, non percepisce reddito residuale da B/C/D
→ L'upline di A (es. Z) continua a ricevere GV da B/C/D attraverso A
  (A è un nodo passante — i PV "passano attraverso" per il calcolo GV)
→ [DA DECIDERE] B/C/D possono essere "riallocati" a un altro sponsor? 
  Questo è molto delicato nel NM — di solito NO.
```

### Edge case: cambio sponsor

```
[DA DECIDERE] È possibile cambiare sponsor?
Nella maggior parte dei NM: NO, mai. L'albero è immutabile.
Se InVinus vuole permetterlo: solo tramite intervento admin, con log,
e ricalcolo completo dei GV per tutta la catena coinvolta.
Suggerimento: NON permetterlo (evita dispute e ricorsi).
```

### Edge case: consulente si iscrive due volte

```
Regola: 1 persona = 1 account consulente. Mai doppi account.
Verifica: email + codice fiscale univoci nel DB.
Se tentativo di doppia iscrizione → blocco + notifica admin.
```

---

## 5. ORDINI EDGE CASES

### Ordine con link referral di consulente inattivo

```
SE un cliente ordina tramite link referral di un consulente inattivo:
  → L'ordine va a buon fine (il cliente non deve essere penalizzato)
  → I PV vengono assegnati al consulente (lo aiutano a ridiventare attivo)
  → La provvigione personale (15%) [DA DECIDERE]: viene pagata anche se inattivo?
  → Suggerimento: SÌ, la provvigione sulla vendita personale si paga sempre.
    L'inattività blocca solo il reddito residuale e i bonus.
```

### Ordine a se stesso (autoconsumo)

```
Il consulente può acquistare per sé → genera PV (autoconsumo).
Questo è esplicitamente previsto nel Compensation Plan.
Limite: [DA DECIDERE] C'è un tetto massimo di PV da autoconsumo?
Suggerimento: non serve un tetto, ma monitorare anomalie 
(consulente che fa 100% autoconsumo e 0% vendite è sospetto).
Flag nel backoffice: "% autoconsumo su PV totali" per consulente.
```

### Ordine B2B (HoReCa)

```
[DA DECIDERE] Gli ordini B2B generano PV? A che tasso di conversione?
Se sì: il consulente che porta un ristorante guadagna PV regolarmente
Se no: serve un sistema di commissioni B2B separato
Suggerimento: SÌ, stessi PV. Il canale B2B è solo un tipo di cliente.
```

---

## 6. CALCOLO PROVVIGIONI EDGE CASES

### Mese con zero consulenti attivi in un livello

```
SE nel calcolo reddito residuale, un livello ha zero PV/GV:
  → Quel livello contribuisce 0€ al reddito residuale
  → Non è un errore, è normale (soprattutto per i livelli 5-8)
```

### Global Pool con zero Golden attivi

```
SE a fine anno non ci sono Golden attivi:
  → Il 3% del fatturato per il Global Pool resta in azienda
  → [DA DECIDERE] Viene accantonato per l'anno successivo o è perso?
```

### Provvigioni sotto soglia minima di pagamento

```
[DA DECIDERE] Esiste una soglia minima per il payout?
Esempio: se un consulente ha maturato 2,50€ di provvigioni:
  → Pagare comunque (micro-transaction, costo Stripe)
  → Accumulare fino a raggiungere es. 10€ o 25€
  → Suggerimento: soglia minima 10€, accumulabile
```

### Bonus Car: come funziona concretamente?

```
Il Compensation Plan dice: "Bonus Car riservato a Ambassador e Golden attivi"
[DA DECIDERE] Importo fisso mensile? Rimborso leasing? Contributo?
Questo impatta il calcolo provvigioni e il budget annuale.
```

---

## 7. DATI E PRIVACY

### Visibilità dati nell'albero

```
Cosa può vedere un consulente del suo team?
  → Nome e cognome dei diretti: SÌ
  → PV dei diretti: SÌ (serve per calcolare la propria performance)
  → PV di livelli più profondi: [DA DECIDERE] Aggregati o individuali?
  → Email/telefono dei diretti: [DA DECIDERE] Solo se consenso GDPR?
  → Clienti dei diretti: NO (privacy)
  → Provvigioni dei diretti: NO
```

### Cancellazione account (GDPR art. 17)

```
SE un consulente/cliente chiede la cancellazione dati:
  → Anonimizzare i dati personali (nome, email, telefono → hash)
  → Mantenere i dati aggregati (PV, ordini, albero) con ID anonimizzato
  → L'albero genealogico deve restare integro (il nodo diventa "Utente rimosso")
  → I GV storici non devono cambiare (sono dati contabili)
```

---

## 8. RIEPILOGO DECISIONI DA PRENDERE

Lista delle [DA DECIDERE] — tutte richiedono risposta dal team prima dell'implementazione:

| # | Domanda | Impatto | Suggerimento |
|---|---------|---------|--------------|
| 1 | PV al pagamento o alla consegna? | Tempistica conteggio PV | Al pagamento |
| 2 | Storno PV su resi dopo 14 giorni? | Complessità ricalcolo | Solo reso totale |
| 3 | Promozioni confermate in tempo reale o a fine mese? | UX consulente | Fine mese |
| 4 | Provvigione personale anche se inattivo? | Costo aziendale | Sì, sempre |
| 5 | PV inattivo contano come GV per l'upline? | Equità del piano | Sì |
| 6 | Tetto autoconsumo? | Compliance NM | No tetto, ma monitoraggio |
| 7 | Ordini B2B generano PV? | Scalabilità canale HoReCa | Sì, stessi PV |
| 8 | Soglia minima payout provvigioni? | Costo transazioni | 10€ |
| 9 | Importo Bonus Car? | Budget annuale | Da definire con FP |
| 10 | Global Pool non distribuito → accantona o perso? | Contabilità | Accantona |
| 11 | Visibilità PV livelli profondi? | Privacy e motivazione | Solo aggregati |
| 12 | Riallocazione consulenti a nuovo sponsor? | Integrità albero | No, mai |
| 13 | Dopo quanti mesi inattivo → stato dormiente? | Pulizia dati | 12 mesi |

---

## 9. CLASSIFICAZIONE SINCRONO vs BATCH

Per l'architettura dei job e degli handler, ogni edge case va gestito
in modo diverso a seconda di quando deve scattare:

### Logica SINCRONA (eseguita al momento dell'evento)

| Regola | Trigger | Dove nel codice |
|--------|---------|-----------------|
| Ordine annullato pre-spedizione → no PV | Cambio stato ordine | Handler `ordini.onStatusChange()` |
| Verifica doppia iscrizione consulente | Creazione account | Middleware `consulenti.onCreate()` |
| Link referral di inattivo → ordine va a buon fine | Creazione ordine | Handler `ordini.onCreate()` |
| Stock negativo bloccato | Movimento magazzino | Constraint DB + service `magazzino.registraUscita()` |
| Autoconsumo → PV immediati | Creazione ordine self | Handler `ordini.onCreate()` tipo=AUTOCONSUMO |

### Logica BATCH (job schedulato a fine mese)

| Regola | Frequenza | Job |
|--------|-----------|-----|
| Calcolo PV/GV consolidati | Mensile | `jobs/calcoloProvvigioni.ts` |
| Verifica promozioni (cambio status) | Mensile (dopo consolidamento PV) | `jobs/verificaPromozioni.ts` |
| Storno PV per resi del mese | Mensile (prima del consolidamento) | `jobs/applicaStorni.ts` |
| Check inattività (PV < requisito) | Mensile | `jobs/checkAttivita.ts` |
| Calcolo CAB, Bonus Car | Mensile (dopo promozioni) | `jobs/calcoloBonus.ts` |
| Global Pool | Annuale | `jobs/globalPool.ts` |
| Check dormienza (>12 mesi inattivo) | Mensile | `jobs/checkDormienza.ts` |
| Soglia minima payout → accumulare | Mensile (dopo calcolo totale) | `jobs/preparaPayout.ts` |

### Ordine di esecuzione batch mensile (CRITICO)

```
1. applicaStorni()        ← prima storna i PV dei resi
2. calcoloProvvigioni()   ← poi consolida PV/GV netti
3. checkAttivita()        ← poi determina chi è attivo
4. verificaPromozioni()   ← poi promuove chi ha raggiunto soglia
5. calcoloBonus()         ← poi calcola CAB e Bonus Car (servono status aggiornati)
6. preparaPayout()        ← infine prepara i pagamenti (applica soglia minima)
```

L'ordine è importante: se promuovi prima di stornare, potresti promuovere
qualcuno che non ha più i PV sufficienti.
