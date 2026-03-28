# 08 — Roadmap di Sviluppo per Claude Code

> Questo documento definisce l'ordine di sviluppo. Ogni step produce output concreto
> e testabile. Non saltare step: ogni fase si appoggia sulla precedente.

---

## FASE 0 — FONDAMENTA (fare SUBITO)

### Step 0.1: Schema DB
**Input:** doc 07 (entità e relazioni) + doc 02 (tabella qualifiche) + doc 03 (catalogo)
**Output:** file SQL con CREATE TABLE per PostgreSQL
**Prompt suggerito:**
```
Leggi docs/07-flussi-e-modello-mentale.md (sezione "Entità chiave") e 
docs/02-compensation-plan.md (tabella qualifiche). Genera lo schema PostgreSQL 
completo con: tabelle, FK, indici, enum per status e tipi, vincoli, commenti. 
Includi anche la tabella di seed per i livelli di carriera con le percentuali.
```

### Step 0.2: Seed dati
**Input:** doc 03 (catalogo vini) + doc 02 (tabella qualifiche)
**Output:** file SQL INSERT con: tutti i prodotti del catalogo + tabella qualifiche/livelli
**Prompt suggerito:**
```
Dal catalogo in docs/03-catalogo-prodotti.md genera le INSERT per popolare la 
tabella prodotti. Poi genera la tabella di configurazione delle qualifiche con 
tutti gli 8 status, i requisiti PV/GV e le percentuali per livello dal doc 02.
```

### Step 0.3: Modello mentale scritto (10-20 righe)
**Output:** testo breve che descrive il "chi fa cosa" in linguaggio naturale, usabile come system prompt per la Chat AI e come guida per ogni sviluppatore.

```
InVinus è un sistema di vendita diretta di vini italiani.

ATTORI: Admin, Consulente, Cliente finale.

FLUSSO PRINCIPALE: Un Consulente acquisisce clienti tramite serate di 
degustazione, link referral e contatti diretti. Ogni acquisto genera Punti 
Volume (PV) per il Consulente e Punti Volume Gruppo (GV) per tutta la sua 
catena di upline (sponsor). I PV e GV determinano lo status del Consulente 
(8 livelli da Starter a Golden) e le provvigioni che percepisce.

PROVVIGIONI: Ogni Consulente guadagna il 15% sulle proprie vendite. In più, 
se ha costruito un team, guadagna una percentuale (reddito residuale) sui PV 
generati dai consulenti nei livelli sottostanti. Le percentuali e il numero 
di livelli dipendono dal suo status.

REGOLA FONDAMENTALE: Lo status non retrocede mai. Ma per percepire provvigioni
in un dato mese, il Consulente deve essere "attivo" (raggiungere il PV minimo 
del suo status).

GESTIONE CANTINA: Sia Consulenti che Clienti possono tracciare la propria 
collezione vini (giacenze, note degustazione, wishlist). L'AI suggerisce 
riordini e abbinamenti basandosi su questa cantina personale.

CHAT AI: Consulenti e clienti hanno accesso a un assistente AI che conosce 
il catalogo, le condizioni commerciali, le FAQ e — per utenti autenticati — 
i dati personali (ordini, status, team).
```

---

## FASE 1 — BACKEND API (settimane 1-3)

### Step 1.1: Setup progetto
- Lo schema SQL è già su Supabase (caricato in Fase 0)
- Le API CRUD base sono automatiche (PostgREST di Supabase) — non serve scriverle
- Auth: Supabase Auth con ruoli (admin, consulente, cliente) tramite Row Level Security
- Logica custom: Supabase Edge Functions (TypeScript/Deno)
- Frontend: Next.js con App Router, connesso a Supabase via `@supabase/supabase-js`

### Step 1.2: API — cosa è automatico e cosa è custom

**Automatico (PostgREST di Supabase, zero codice):**
Tutte le operazioni CRUD su: prodotti, consulenti, clienti, ordini, lead, eventi.
Si usano direttamente dal frontend con il client Supabase JS.

**Custom (Edge Functions da sviluppare):**

| Endpoint | Cosa fa |
|----------|---------|
| `POST /functions/v1/calcola-provvigioni` | Batch: calcola tutte le provvigioni del mese (admin) |
| `POST /functions/v1/crea-ordine` | Crea ordine + calcola PV + aggiorna GV (logica complessa) |
| `GET /functions/v1/albero/:id` | Ritorna albero genealogico con CTE ricorsiva fino a 8 livelli |
| `GET /functions/v1/dashboard/:id` | PV, GV, status, progresso, commissioni mese (aggregazione) |
| `POST /functions/v1/chat` | Chat AI: compone prompt con contesto utente + catalogo, chiama Claude |
| `GET /functions/v1/cantina-alert/:id` | Scorte basse + suggerimenti riordino |

### Step 1.4: Logica provvigioni (il cuore)
**File dedicato:** `services/provvigioni.js` (o `.py`)

```
function calcolaProvvigioniMese(mese, anno):
  1. Carica tutti i consulenti
  2. Per ciascuno:
     a. Somma PV del mese (ordini propri)
     b. Percorri albero downline, sommando PV per livello → GV
     c. Determina se attivo (PV ≥ requisito status)
     d. Verifica promozione (PV+GV ≥ prossimo status) → promuovi se sì
     e. Calcola:
        - provvigione_personale = 15% × fatturato vendite mese
        - reddito_residuale = Σ (per ogni livello sbloccato: % × GV_livello)
        - cab = (se Director+) importo_cab × count(consulenti attivi nei livelli)
        - bonus_car = (se Ambassador+ e GV soddisfatto) importo fisso
     f. Salva record in tabella provvigioni
  3. Global Pool: (fine anno) 3% × fatturato_annuo / count(Golden attivi)
```

---

## FASE 2 — BACKOFFICE WEB (settimane 3-5)

### Step 2.1: Setup frontend
- Next.js 14+ con App Router e TypeScript (già inizializzato in Fase 1)
- Supabase Auth per login (3 righe di codice)
- Tailwind CSS per styling: tema dark luxury (nero #0A0A0A, oro #C8A85C, bianco #F5F5F5)
- Layout con sidebar: Dashboard, Consulenti, Clienti, Ordini, Prodotti, Provvigioni, Eventi
- Responsive: stesse pagine, layout adattato per mobile (card invece di tabelle)

### Step 2.2: Viste admin
- **Dashboard:** KPI globali (fatturato mese, consulenti attivi, ordini, trend)
- **Gestione catalogo:** CRUD prodotti con immagini, prezzi, disponibilità
- **Gestione consulenti:** lista, dettaglio con albero, approvazione, cambio status
- **Report provvigioni:** tabella mensile, export CSV, drill-down per consulente
- **Gestione ordini:** lista, stati, filtri per periodo/consulente

### Step 2.3: Viste consulente (backoffice personale)
- **Dashboard personale:** PV/GV mese, status, barra progresso, guadagni
- **Il mio team:** albero downline interattivo, performance per membro
- **I miei clienti:** lista con ultimo ordine, link per aggiungere
- **Le mie provvigioni:** storico mensile, breakdown per voce
- **Catalogo:** vista per condividere (genera link referral)

---

## FASE 3 — GESTIONE CANTINA + MOBILE (settimane 5-8)

### Step 3.1: API Cantina Personale (Edge Functions)
```
POST   /functions/v1/cantina              → aggiungi bottiglia
GET    /functions/v1/cantina              → lista giacenze
PUT    /functions/v1/cantina/:id          → aggiorna quantità/note
DELETE /functions/v1/cantina/:id          → rimuovi
GET    /functions/v1/cantina/suggerimenti → LLM: cosa riordinare, cosa abbinare
GET    /functions/v1/cantina/statistiche  → consumi, rotazioni, preferenze
```

### Step 3.2: Viste mobile (PWA)
**L'app è la stessa web app Next.js, resa responsive e installabile come PWA.**
Non c'è un progetto separato. Le stesse pagine si adattano al mobile via Tailwind.

Aggiungere al progetto Next.js:
- `manifest.json` per installabilità (icona, nome, colori)
- Service Worker per cache offline del catalogo
- Layout responsive: sotto 768px → card invece di tabelle, menu hamburger

Schermate:
1. **Home:** riepilogo rapido (PV mese, ordini recenti, notifiche)
2. **Cantina personale:** lista bottiglie, aggiungi/rimuovi, note degustazione
3. **Catalogo:** sfoglia per regione/tipo, condividi su WhatsApp
4. **Dashboard CRM:** versione semplificata della vista desktop
   - Card con PV/GV e barra progresso
   - Lista ultimi ordini
   - Albero team (primo livello con espansione)
   - Commissioni mese
5. **Chat AI:** interfaccia conversazionale integrata
6. **Profilo:** dati personali, link referral, QR code

**Adattamento mobile vs desktop:**
| Vista desktop | Vista mobile |
|---------------|-------------|
| Tabella ordini con 10 colonne | Card con info essenziali (data, importo, stato) |
| Albero genealogico completo | Solo L1 con tap per espandere |
| Grafici provvigioni multi-mese | Singola card "questo mese" + trend sparkline |
| CRUD completo prodotti | Solo lettura catalogo + condivisione |

---

## FASE 4 — CHAT AI (settimane 6-9, parallela a Fase 3)

### Step 4.1: Knowledge base
1. Indicizzare con **pgvector** (estensione PostgreSQL già disponibile su Supabase — zero servizi aggiuntivi):
   - Schede prodotto (dal catalogo)
   - Piano compensi (regole e qualifiche)
   - FAQ: politica resi, tempi consegna, costi spedizione, come funziona PV/GV
   - Abbinamenti cibo-vino
   - Storie delle cantine

2. Chunking: ogni scheda prodotto = 1 chunk, ogni sezione FAQ = 1 chunk

### Step 4.2: Architettura RAG + CRM (Edge Function)
```
[Utente fa domanda]
       │
       ▼
[Edge Function /functions/v1/chat]
  → Identifica utente da JWT (Supabase Auth)
  → Query Supabase: carica contesto personale (status, PV, ordini, cantina)
       │
       ▼
[Retrieval] → pgvector su Supabase → top-K chunks rilevanti
       │        (catalogo, FAQ, condizioni)
       ▼
[Composizione prompt]
  System: "Sei l'assistente InVinus..." (doc 11)
  Contesto utente: {dati da Supabase}
  Contesto catalogo: {chunks pgvector}
  Domanda: {testo utente}
       │
       ▼
[Chiama API Claude Sonnet]
       │
       ▼
[Ritorna risposta al frontend]
```

### Step 4.3: System prompt base per la Chat AI
```
Sei l'assistente virtuale di InVinus, piattaforma di vendita diretta di vini 
italiani selezionati. Il tuo tono è cordiale, competente e premium — coerente 
con l'identità "dark luxury" del brand.

COSA SAI FARE:
- Consigliare vini e abbinamenti dal catalogo InVinus
- Spiegare come funziona il piano compensi e la carriera
- Rispondere a domande su ordini, spedizioni, resi
- Mostrare dati personalizzati dell'utente (se autenticato)
- Suggerire riordini basati sulla cantina personale

COSA NON FAI:
- Non inventi vini che non sono nel catalogo
- Non dai consigli medici sull'alcol
- Non prometti guadagni specifici (compliance NM)
- Non condividi dati di un utente con un altro

FORMATO RISPOSTE:
- Brevi e dirette, adatte al mobile
- Se menzioni un vino, includi: nome, regione, prezzo, temperatura di servizio
- Se l'utente chiede del suo status/PV/GV, mostra i numeri e quanto manca al prossimo livello
```

---

## FASE 5 — INTEGRAZIONI E POLISH (settimane 9-12)

- Stripe: checkout ordini (Next.js API Route) + payout provvigioni (Stripe Connect)
- Email transazionali: Supabase Auth emails + servizio SMTP (Resend free tier o simile)
- Web Push notifications: traguardi carriera, promemoria riordino, nuovi prodotti
- WhatsApp Business API: condivisione catalogo, inviti serate (P2, non MVP)
- Tracking corriere: webhook per aggiornamento stato spedizione (P2)
- Export contabilità: CSV/PDF generati da Edge Function

---

## Riepilogo timeline

| Fase | Cosa | Settimane | Dipendenze |
|------|------|-----------|------------|
| 0 | Schema DB su Supabase + seed + modello mentale | 0 (fatto) | Nessuna |
| 1 | Edge Functions custom + integrazione Next.js | 1-3 | Fase 0 |
| 2 | Backoffice web (admin + consulente) | 3-5 | Fase 1 |
| 3 | Gestione cantina + PWA mobile | 5-8 | Fase 1 |
| 4 | Chat AI (pgvector + Claude API) | 6-9 | Fase 1 + knowledge base |
| 5 | Integrazioni esterne + polish | 9-12 | Tutto il resto |

Le fasi 3 e 4 possono procedere in parallelo perché entrambe dipendono solo dalla Fase 1 (API).

---

## FASE 6 — FEATURE EVOLUTE (post-MVP, trimestre 2)

Due feature che nessun competitor wine club/NM ha ancora:

### "Cantina Condivisa"
Il consulente rende visibile (a clienti selezionati) la propria cantina personale con
storytelling e link diretto acquisto. Il cliente vede "cosa beve il mio consulente" e
può ordinare con un tap. È social proof + e-commerce + relazione personale.

**Dipendenze:** Cantina personale (doc 10) + link referral + privacy granulare

### "Wine Match AI"
L'LLM legge: stock consulente + calendario serate + profilo cliente, e propone box
personalizzati in <10 secondi. Output condivisibile su WhatsApp come card con immagini.
Esempio: "Per la cena di sabato di Marco (ama i rossi toscani, budget 80€):
Chianti Classico + Rosso di Montalcino + Poggio Torto. [Ordina box →]"

**Dipendenze:** Use case LLM UC-1 e UC-4 (doc 11) + magazzino operativo + profili cliente
