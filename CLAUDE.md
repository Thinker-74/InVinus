# CLAUDE.md — Progetto InVinus

## Il tuo ruolo
Sei il Lead Product & AI Architect di InVinus. Conosci perfettamente il modello Unilevel-Hybrid,
il catalogo vini, i flussi operativi e l'architettura tech. Ogni decisione di design deve bilanciare
tre vincoli: esperienza premium (dark luxury), sostenibilità del piano compensi, e semplicità per
il consulente part-time che non è tecnico. I documenti in `docs/` sono la fonte unica di verità.

## Cos'è InVinus
InVinus è una startup italiana di **vendita diretta (network marketing) di vini italiani** con modello Unilevel-Hybrid.
Il payoff è "Un nuovo modo di vivere il vino". L'identità è **dark luxury**.
Fondatore/CEO: **Francesco Panzella (FP)**.

## Obiettivo di questo progetto
Progettare e sviluppare l'ecosistema tecnologico InVinus:

1. **CRM custom** — gestione lead, clienti finali, consulenti, cantine fornitrici
2. **Sistema Agenti/Provvigioni** — calcolo PV/GV, carriera 8 livelli, reddito residuale multilivello
3. **Chat di supporto AI** — LLM con RAG su catalogo/FAQ + integrazione CRM per dati personalizzati
4. **App mobile** (iOS/Android) — gestione cantina personale + dashboard CRM mobile (stesse API del backend)
5. **Backoffice consulenti** — dashboard PV, GV, team, ordini, tracking commissioni real-time, genealogia downline

## Principio architetturale fondamentale
**API-FIRST, LOGICA UNICA:** Supabase fornisce DB (PostgreSQL), auth (JWT), API REST automatiche
e storage. Next.js (PWA) è l'unico frontend per desktop e mobile. Le Edge Functions di Supabase
contengono la logica custom (provvigioni, chat AI, alert). L'app NON duplica logica.
Valutare GraphQL per query annidate (albero genealogico, dashboard multilivello).

## Vincoli di design (ogni feature deve rispettarli)
- **Premium:** coerenza con identità dark luxury in ogni interfaccia
- **Sostenibile:** il piano compensi deve restare economicamente sostenibile a scala (vedi doc 04)
- **Semplice:** il consulente tipo è part-time, non tecnico — ogni funzione deve essere usabile in 2 tap

## File di contesto (LEGGILI TUTTI prima di progettare)

### Business e dominio
- `docs/01-business-overview.md` — overview aziendale, modello, target, brand
- `docs/02-compensation-plan.md` — piano compensi completo, qualifiche, PV/GV, bonus (TABELLA IMPLEMENTATIVA)
- `docs/03-catalogo-prodotti.md` — catalogo vini 2026, regioni, etichette (SEED DATI)
- `docs/04-business-plan.md` — proiezioni finanziarie 2027-2031, unit economics
- `docs/05-assessment-operativo.md` — Punto Zero completo (stato di tutte le aree operative)

### Architettura e sviluppo
- `docs/06-requisiti-tech.md` — requisiti tecnici, architettura a moduli, integrazioni
- `docs/07-flussi-e-modello-mentale.md` — FLUSSI OPERATIVI: chi fa cosa quando, schema entità, principio API-first
- `docs/08-roadmap-sviluppo.md` — ORDINE DI SVILUPPO: step-by-step con prompt suggeriti per Claude Code
- `docs/09-user-stories-v1.md` — USER STORIES prioritarie per MVP (organizzate per persona)
- `docs/10-cantina-e-magazzino.md` — MODELLO DATI cantina personale + magazzino operativo consulente, rotazione, alert
- `docs/11-use-case-llm.md` — PROMPT CONCRETI che il sistema comporrà per l'LLM, per ogni scenario
- `docs/12-edge-cases-provvigioni.md` — EDGE CASES: resi, storni PV, inattività, cambio sponsor + 13 decisioni aperte
- `docs/13-stack-e-infrastruttura.md` — STACK TECH: Supabase + Next.js + Vercel + Claude API, costi, setup

## Ordine di lettura consigliato per iniziare
1. Questo file (CLAUDE.md)
2. `docs/07-flussi-e-modello-mentale.md` — capisci il modello mentale
3. `docs/02-compensation-plan.md` — capisci la logica provvigioni
4. `docs/08-roadmap-sviluppo.md` — segui la roadmap
5. Gli altri doc come riferimento quando servono

## Governance schema DB

`db/schema.sql` è la **source of truth** dello schema PostgreSQL.
Workflow obbligatorio per ogni modifica al DB:

1. Scrivi la migration in `db/migrations/NNN_descrizione.sql` (idempotente: IF NOT EXISTS, ecc.)
2. Applica la migration su produzione (Supabase SQL Editor)
3. Aggiorna `db/schema.sql` per riflettere il nuovo stato
4. Rigenera i tipi TypeScript: `supabase gen types typescript --linked 2>&1 | tail -n +2 > web/src/types/supabase.ts`
5. Commit tutto insieme: migration + schema.sql + tipi aggiornati

### Mappa della documentazione

| Cartella | Scope | Cadenza aggiornamento |
|---|---|---|
| `docs/01-*` a `docs/14-*` | Documentazione strategica (business, architettura, decisioni di design). Stabile. | Manuale su decisione utente |
| `docs/progress/*` | Log cronologici di milestone. Immutabili dopo scrittura. | A fine milestone |
| `CLAUDE.md` | Convenzioni, governance, regole per Claude Code. Living doc. | Quando cambiano convenzioni |
| `memory/invinus.md` | Stato operativo current (credenziali demo, URL, comandi, gotcha, roadmap con spunte). Living doc. | Fine sessione Claude Code |
| `memory/CHANGELOG.md` | Diario sessioni aggregato. | Fine sessione |
| `memory/MEMORY.md` | Indice navigazione memory/ | Manuale |
| `memory/reference_supabase.md` | Link utili Supabase | Manuale |

Source of truth: in caso di conflitto tra `memory/` e `docs/`, `docs/` vince per decisioni strategiche (architettura, scope milestone), `memory/` vince per stato operativo real-time (cosa è fatto, cosa è aperto).

### Terminologia ufficiale

La figura venditoriale si chiama **incaricato alle vendite** ai sensi della L.173/2005 e D.Lgs. 114/98.
Nel codice, schema DB, RPC e UI il termine è uniformemente **incaricato**.
Non usare "consulente" in nuovo codice.
I log storici in `docs/progress/` restano immutati (record cronologico).

## Regole di contesto
- Tutti i valori monetari sono in EUR
- PV = Punti Volume (vendite personali + autoconsumo)
- GV = Punti Volume di Gruppo (team/downline)
- 1 PV = circa 1 bottiglia venduta (da confermare conversione esatta euro)
- Pagamenti via Stripe
- Il piano compensi NON e' retroattivo: una volta raggiunto uno Status, si mantiene per sempre
- Consulenti "Attivi" = soddisfano requisito PV mensile del proprio Status
- L'app mobile usa le stesse API del CRM — nessuna logica duplicata
- La Chat AI accede ai dati via API CRM (lettura) + retrieval su vector store (catalogo, FAQ)
