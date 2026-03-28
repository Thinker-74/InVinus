# Come usare questo pacchetto in Claude Code

## Setup rapido

### Opzione A — Come progetto Claude Code (consigliata)
1. Crea una cartella per il tuo progetto: `mkdir invinus && cd invinus`
2. Copia tutti i file di questo pacchetto nella cartella
3. Il file `CLAUDE.md` nella root viene letto automaticamente da Claude Code come contesto di progetto
4. Lancia `claude` dalla cartella — Claude avrà già tutto il contesto

### Opzione B — Come knowledge in sessione
1. All'avvio di Claude Code, usa: `claude --project-dir /percorso/invinus-context`
2. Oppure copia il contenuto di CLAUDE.md nel tuo `CLAUDE.md` esistente

## Struttura file

```
invinus-context/
├── CLAUDE.md                          ← Istruzioni progetto (letto automaticamente da Claude Code)
├── README.md                          ← Questo file
└── docs/
    ├── 01-business-overview.md        ← Overview aziendale, modello, target
    ├── 02-compensation-plan.md        ← Piano compensi completo con tabella implementativa
    ├── 03-catalogo-prodotti.md        ← Tutti i vini per regione (seed dati)
    ├── 04-business-plan.md            ← Proiezioni finanziarie e unit economics
    ├── 05-assessment-operativo.md     ← Punto Zero (stato aree operative, domande aperte)
    ├── 06-requisiti-tech.md           ← Architettura moduli, integrazioni esterne
    ├── 07-flussi-e-modello-mentale.md ← ⭐ CHI FA COSA QUANDO, schema entità, principio API-first
    ├── 08-roadmap-sviluppo.md         ← ⭐ STEP-BY-STEP: ordine di sviluppo con prompt
    ├── 09-user-stories-v1.md          ← USER STORIES MVP organizzate per persona (P0/P1/P2)
    ├── 10-cantina-e-magazzino.md      ← Modello dati cantina + magazzino, rotazione, alert riordino
    ├── 11-use-case-llm.md             ← ⭐ PROMPT CONCRETI che il sistema farà all'LLM
    └── 12-edge-cases-provvigioni.md   ← ⭐ EDGE CASES: resi, storni, inattività + 13 decisioni aperte
    └── 13-stack-e-infrastruttura.md   ← ⭐ STACK: Supabase + Next.js + Vercel, costi, setup passo-passo
```

## Come partire (segui la roadmap in docs/08)

### Step 1 — Genera lo schema DB
```
Leggi docs/07-flussi-e-modello-mentale.md (sezione "Entità chiave") e docs/02-compensation-plan.md 
(tabella qualifiche). Genera lo schema PostgreSQL completo con tabelle, FK, indici, enum, vincoli e 
la tabella di seed per i livelli di carriera con le percentuali.
```

### Step 2 — Popola con i dati del catalogo
```
Dal catalogo in docs/03-catalogo-prodotti.md genera le INSERT per popolare la tabella prodotti. 
Poi genera la tabella di configurazione delle qualifiche con tutti gli 8 status, i requisiti PV/GV 
e le percentuali per livello dal doc 02.
```

### Step 3 — API backend
```
Leggi docs/07-flussi-e-modello-mentale.md e docs/08-roadmap-sviluppo.md (Fase 1). 
Inizializza il progetto backend con le API CRUD base + le API specializzate per provvigioni e albero genealogico.
```

### Step 4 — Logica provvigioni
```
Implementa il servizio di calcolo provvigioni mensili seguendo l'algoritmo in docs/08-roadmap-sviluppo.md 
(Step 1.4) e le regole in docs/02-compensation-plan.md. Includi test unitari con scenari: 
Starter che diventa Apprentice, Advisor con team su 2 livelli, Director con CAB.
```

### Step 5 — Chat AI
```
Progetta il sistema RAG per la chat InVinus: indicizza il catalogo (docs/03) e le FAQ 
come vector store, implementa l'endpoint /api/chat che compone il prompt con contesto utente 
(da API CRM) + chunks recuperati + system prompt (da docs/08, Step 4.3).
```

## Note importanti
- I file originali del progetto (PDF, DOCX) sono stati estratti e ristrutturati in markdown leggibile
- Il piano compensi è stato normalizzato in tabella per facilitare l'implementazione
- Il catalogo contiene tutti i vini con dati tecnici (alcol, temperatura, denominazione)
- Il doc 07 (flussi) è il documento più importante: descrive il "modello mentale" del sistema
- Il doc 08 (roadmap) dà l'ordine di sviluppo — non saltare fasi
- Il Punto Zero (doc 05) contiene domande APERTE — molte risposte devono ancora arrivare dal team
- I dati finanziari sono proiezioni basate su ipotesi (5 prodotti/mese per consulente attivo)
- L'app mobile e la chat AI NON hanno logica propria: chiamano le stesse API del backend
