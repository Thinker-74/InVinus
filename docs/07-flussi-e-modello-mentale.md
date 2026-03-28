# 07 — Modello Mentale del CRM e Flussi Operativi

> Questo documento descrive CHI fa COSA e QUANDO.
> È il "cervello" del sistema: ogni API, ogni schermata, ogni calcolo parte da qui.

---

## Il modello in una frase

InVinus è una piattaforma dove **Consulenti** vendono vino a **Clienti finali** tramite
serate, link referral e relazioni dirette. Ogni vendita genera **PV** per il Consulente
e **GV** per tutta la sua catena di upline. Il sistema calcola provvigioni, monitora
la carriera e fornisce strumenti di gestione (catalogo, cantina, CRM mobile, chat AI)
che parlano tutti con le **stesse API**.

---

## I 4 attori del sistema

| Attore | Cosa fa nel sistema | Cosa vede |
|--------|---------------------|-----------|
| **Admin InVinus** | Gestisce catalogo, approva consulenti, lancia promozioni, calcola provvigioni, monitora KPI | Backoffice completo, report, gestione globale |
| **Consulente** | Vende vino, recluta nuovi consulenti, organizza serate, gestisce i propri clienti | Dashboard PV/GV, albero team, commissioni, catalogo condivisibile, chat AI |
| **Cliente finale** | Acquista vino, partecipa a serate, gestisce la propria cantina | Catalogo, storico ordini, cantina personale, chat supporto |
| **Chat AI (LLM)** | Risponde a domande, suggerisce vini, mostra dati personalizzati | Accesso in lettura a: catalogo, condizioni commerciali, FAQ, dati CRM del richiedente |

---

## I 6 flussi operativi principali

### FLUSSO 1: Acquisizione nuovo Consulente

```
[Lead]  →  Contatto (sponsor esistente o marketing)
        →  Presentazione opportunità (serata / 1-to-1 / webinar)
        →  Iscrizione + acquisto Starter Kit (123€)
        →  Creazione account CRM (status: STARTER, sponsor_id: chi l'ha portato)
        →  Onboarding 90 giorni (welcome kit, formazione, mentor)
        →  Prima vendita → primi PV
```

**Nel sistema:**
- CRM crea record Consulente con `sponsor_id` (genera il ramo nell'albero genealogico)
- Stripe processa pagamento Starter Kit
- Email automatica di benvenuto + credenziali backoffice
- Il consulente compare nell'albero del suo sponsor (L1)

---

### FLUSSO 2: La trattativa / vendita

```
[Consulente]  →  Identifica potenziale cliente (rete personale, serata, social)
              →  Condivide catalogo (WhatsApp, link personale, mini-sito)
              →  Cliente sceglie prodotti
              →  Ordine tramite link referral del Consulente (tracciato)
              →  Pagamento Stripe
              →  Sistema registra: ordine + PV al Consulente + GV alla catena upline
              →  Spedizione dalla cantina/magazzino
              →  Follow-up automatico (email post-acquisto, proposta riordino)
```

**Nel sistema:**
- Ogni ordine ha un `consulente_id` (chi ha generato la vendita)
- PV = calcolati sull'importo netto dell'ordine (conversione €→PV da definire)
- GV = i PV del Consulente vengono sommati ai GV di tutta la catena upline
- Trigger automatico: se il Consulente raggiunge soglia PV/GV → cambio status (promozione)

---

### FLUSSO 3: Calcolo provvigioni mensili (batch)

```
[Fine mese]  →  Per ogni Consulente:
             1. Somma PV del mese (vendite personali + autoconsumo)
             2. Somma GV del mese (PV di tutta la downline, per livello)
             3. Verifica status: PV ≥ requisito? → Consulente ATTIVO
             4. Verifica promozione: PV+GV ≥ soglia prossimo status? → PROMUOVI (irreversibile)
             5. Calcola provvigione personale: 15% × fatturato vendite personali
             6. Calcola reddito residuale: per ogni livello sbloccato, % × GV di quel livello
             7. Calcola bonus CAB: (Director+) €/consulente attivo nei propri livelli
             8. Calcola Bonus Car: (Ambassador+, se GV soddisfatto)
             →  Genera report provvigioni
             →  Autorizza pagamento (Stripe Connect o bonifico)
```

**Nel sistema:**
- Job schedulato (cron) o trigger manuale admin a fine mese
- L'algoritmo percorre l'albero genealogico dal basso verso l'alto
- Ogni nodo accumula i PV dei sotto-nodi come GV
- Le percentuali per livello dipendono dallo status del Consulente (tabella in doc 02)
- Output: tabella `provvigioni_mensili` con breakdown per voce

---

### FLUSSO 4: Serata di degustazione

```
[Consulente]  →  Pianifica serata (data, luogo, numero invitati)
              →  Sistema genera inviti (email/WA/SMS con link RSVP)
              →  Serata avviene (fisica o online)
              →  Post-serata: Consulente registra partecipanti nel CRM
              →  Follow-up automatico ai partecipanti (entro 24-48h)
              →  Partecipanti che acquistano → ordini tracciati → PV
              →  Partecipanti interessati al business → lead per reclutamento
```

**Nel sistema:**
- Entità `Evento` con: consulente_organizzatore, data, tipo, partecipanti, ordini_generati
- KPI serata: tasso conversione partecipanti→clienti, ordine medio, nuovi lead
- Automazione: sequenza email/WA post-serata (giorno +1, +3, +7)

---

### FLUSSO 5: Riordino / fidelizzazione cliente

```
[Sistema]  →  Monitora ultima data acquisto per cliente
           →  Se ultimo ordine > X giorni → trigger riordino
           →  Notifica al Consulente ("Il tuo cliente Mario non ordina da 45 giorni")
           →  Opzionale: email/WA automatica al cliente ("Ti manca il Brunello?")
           →  Se il cliente ha la "gestione cantina" → analisi giacenze
           →  Chat AI può suggerire: "In base alla tua cantina, ti consiglio di riordinare..."
```

**Nel sistema:**
- Trigger basato su `data_ultimo_ordine` per cliente
- Il Consulente riceve notifica push / email
- La Chat AI ha contesto: storico ordini + cantina personale + catalogo

---

### FLUSSO 6: Chat AI — ciclo domanda/risposta

```
[Utente]  →  Apre chat (da web, da app, da backoffice)
          →  Sistema identifica: è Consulente o Cliente? → carica contesto appropriato
          →  Utente fa domanda
          →  LLM riceve:
             - System prompt con ruolo e regole InVinus
             - Contesto utente via API CRM (chi è, suo status, suoi ordini, suo team)
             - Contesto catalogo via retrieval (RAG su schede prodotto, FAQ, condizioni)
             - Domanda dell'utente
          →  LLM risponde con info personalizzata
```

**Esempi di domande e fonti dati:**

| Domanda | Fonte dati |
|---------|-----------|
| "Quanto mi manca per diventare Supervisor?" | API CRM → PV/GV attuali + tabella qualifiche |
| "Quale vino abbinare a un arrosto?" | RAG → schede prodotto + abbinamenti |
| "Quanto ho guadagnato questo mese?" | API CRM → provvigioni maturate |
| "Quando arriva il mio ordine?" | API CRM → stato ordine + tracking corriere |
| "Cosa posso proporre a un cliente che ama i bianchi toscani?" | RAG catalogo + filtro regione/tipo |
| "Ho ancora Brunello in cantina?" | API gestione cantina → giacenze utente |

---

## Il principio architetturale: API-FIRST, LOGICA UNICA

```
                    ┌────────────────────────────┐
                    │     SUPABASE (backend)      │
                    │                            │
                    │  PostgREST (CRUD auto)     │
                    │  Edge Functions (custom):  │
                    │   • provvigioni            │
                    │   • albero genealogico     │
                    │   • chat AI                │
                    │   • alert cantina          │
                    │  Auth (JWT + ruoli)        │
                    │  Storage (immagini)        │
                    └──────────┬─────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼──────┐ ┌──────▼──────┐ ┌───────▼──────┐
     │  Next.js      │ │  Stessa app │ │  Edge Func.  │
     │  Desktop      │ │  su mobile  │ │  /chat       │
     │               │ │  (PWA)      │ │              │
     │ Viste complete│ │ Viste       │ │ Lettura DB   │
     │ Admin + cons. │ │ responsive  │ │ + Claude API │
     │               │ │ card, touch │ │              │
     └───────────────┘ └─────────────┘ └──────────────┘
```

**Regola d'oro:** Desktop e mobile sono la STESSA app Next.js, responsive.
La chat AI è una Edge Function separata che legge dallo stesso DB.
Nessuna logica duplicata, nessun backend custom da mantenere.

---

## Schema delle entità e relazioni (modello mentale per il DB)

```
Consulente ──1:N──→ Ordine ←──N:1── Cliente
     │                  │
     │ sponsor_id       │ contiene
     │ (auto-ref)       │
     ▼                  ▼
Consulente          OrdineRiga ──→ Prodotto ──→ Cantina_Fornitrice
(albero)                              │
                                      │
     Consulente ──1:N──→ Evento       │
                           │          │
                    partecipanti      │
                           │          ▼
                        Lead    Cantina_Personale (giacenze utente)
                                      │
                                      │ voci
                                      ▼
                              CantinaPers_Riga ──→ Prodotto
```

### Entità chiave

**Consulente:** id, nome, cognome, email, telefono, codice_fiscale, sponsor_id (FK self), status, status_max, data_iscrizione, attivo, formazione_completata, link_referral

**Cliente:** id, nome, cognome, email, telefono, consulente_id (FK → chi l'ha portato), data_primo_acquisto, segmento, note

**Prodotto:** id, nome, denominazione, regione, annata, alcol, temp_servizio, tipo (rosso/bianco/rosato/spumante), prezzo_pubblico, costo_fornitore, pv_valore, cantina_fornitrice_id, scheda_narrativa, abbinamenti, disponibile

**Ordine:** id, cliente_id, consulente_id, data, totale, stato (nuovo/pagato/spedito/consegnato), stripe_payment_id, tracking_code, pv_generati

**OrdineRiga:** id, ordine_id, prodotto_id, quantità, prezzo_unitario, pv_riga

**Provvigione:** id, consulente_id, mese, anno, pv_mese, gv_mese, provvigione_personale, reddito_residuale_dettaglio (JSON per livello), cab_bonus, bonus_car, totale, stato_pagamento

**Evento:** id, consulente_id, data, tipo (serata/wine_party/webinar), luogo, partecipanti_previsti, partecipanti_effettivi, ordini_generati, note

**CantinaPersonale:** id, utente_id (consulente o cliente), prodotto_id, quantità, note_degustazione, data_aggiunta

**Lead:** id, nome, email, telefono, fonte, consulente_id, stato_funnel, data_contatto, note
