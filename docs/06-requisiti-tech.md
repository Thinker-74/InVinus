# 06 — Requisiti Tecnici (derivati dai documenti InVinus)

## Architettura complessiva

Il sistema InVinus è composto da 5 moduli interconnessi:

### Stack scelto (vedi doc 13 per dettagli)
- **DB + Auth + API + Storage:** Supabase (PostgreSQL managed + PostgREST + Auth + Storage)
- **Logica custom:** Supabase Edge Functions (TypeScript/Deno)
- **Frontend (desktop + mobile):** Next.js (PWA) su Vercel
- **Admin catalogo:** Directus (headless CMS su stesso PostgreSQL)
- **Chat AI:** API Claude (Sonnet) chiamata da Edge Function
- **Pagamenti:** Stripe
- **Query annidate (albero, dashboard):** CTE PostgreSQL ricorsive (valutare GraphQL in futuro)

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│  ┌──────────────────────────────────────────────┐   │
│  │  Next.js (PWA) su Vercel                     │   │
│  │  Desktop: backoffice admin + consulente       │   │
│  │  Mobile: stesso sito, responsive, installabile│   │
│  └─────────────────┬────────────────────────────┘   │
│                    │                                  │
│         Supabase client JS (REST auto)               │
│                    │                                  │
│  ┌─────────────────┴────────────────────────────┐   │
│  │           SUPABASE (managed)                  │   │
│  │  ┌─────────────┐ ┌──────────────────────┐    │   │
│  │  │ PostgreSQL  │ │ Auth (JWT + ruoli)   │    │   │
│  │  │ (schema.sql)│ │ (login, registrazione)│   │   │
│  │  └─────────────┘ └──────────────────────┘    │   │
│  │  ┌─────────────┐ ┌──────────────────────┐    │   │
│  │  │ PostgREST   │ │ Storage              │    │   │
│  │  │ (API auto)  │ │ (immagini prodotti)  │    │   │
│  │  └─────────────┘ └──────────────────────┘    │   │
│  │  ┌──────────────────────────────────────┐    │   │
│  │  │ Edge Functions (TypeScript/Deno)     │    │   │
│  │  │ • Calcolo provvigioni (batch)        │    │   │
│  │  │ • Albero genealogico (CTE ricorsiva) │    │   │
│  │  │ • Chat AI (chiama API Claude)        │    │   │
│  │  │ • Alert scorta bassa (cron)          │    │   │
│  │  │ • Link referral (generazione)        │    │   │
│  │  └──────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────┘   │
│                    │                                  │
│  ┌─────────────────┴────────────────────────────┐   │
│  │       SERVIZI ESTERNI                         │   │
│  │  Stripe │ API Claude │ SMTP │ WhatsApp API    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  Directus (opzionale, stesso PostgreSQL)      │   │
│  │  Admin catalogo, cantine, dati "piatti"       │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## MODULO 1: CRM

### Entità principali
- **Consulente** — profilo, status carriera, PV, GV, sponsor (upline), team (downline), storico ordini, commissioni, dati fiscali
- **Cliente finale** — profilo, storico acquisti, preferenze vino, fonte (da quale consulente), programma fedeltà
- **Lead** — contatto potenziale, fonte, stato funnel, assegnazione consulente
- **Cantina fornitrice** — anagrafica, catalogo etichette fornite, condizioni, referente
- **Ordine** — prodotti, quantità, importo, stato, consulente collegato, PV generati, link referral usato
- **Evento/Serata** — data, luogo, consulente organizzatore, partecipanti, ordini generati

### Funzionalità CRM
- Gestione pipeline lead con stati (nuovo, contattato, invitato a serata, cliente, consulente)
- Distinzione netta tra clienti finali e consulenti nel sistema
- Storico interazioni per lead/cliente
- Automazioni post-evento (follow-up, proposta riordino)
- Automazioni riordino periodico
- Segmentazione per: regione, preferenze vino, frequenza acquisto, LTV
- Dashboard KPI: CAC, LTV, ordine medio, frequenza riordino, retention

---

## MODULO 2: SISTEMA AGENTI / PROVVIGIONI / CARRIERA

### Modello dati carriera
```
Consulente {
  id
  nome, cognome, email, telefono
  status: enum [STARTER, APPRENTICE, ADVISOR, SUPERVISOR, 
                 TEAM_COORDINATOR, MANAGER, DIRECTOR, AMBASSADOR, GOLDEN]
  status_max_raggiunto: enum  // non retrocede mai
  sponsor_id -> Consulente  // chi l'ha introdotto (upline diretto)
  pv_mese_corrente: decimal
  gv_mese_corrente: decimal
  data_iscrizione
  data_ultimo_status_change
  formazione_completata: boolean  // per intermezzo formativo Manager
  attivo: boolean  // soddisfa requisito PV mensile
}
```

### Logica calcolo provvigioni (mensile)
1. Per ogni consulente attivo, calcolare PV del mese
2. Calcolare GV sommando i PV di tutta la downline (fino alla profondità del livello sbloccato)
3. Determinare status raggiunto (confronto PV/GV con requisiti tabella)
4. Se nuovo status > status attuale → promozione (irreversibile)
5. Calcolare provvigione personale: 15% × fatturato vendite personali
6. Calcolare reddito residuale: per ogni livello sbloccato, applicare % sui PV del livello
7. Calcolare bonus CAB: (solo Director+) €/consulente attivo nei livelli
8. Calcolare Bonus Car: (solo Ambassador+, se GV mensile soddisfatto)
9. Global Pool: (solo Golden) 3% fatturato annuo ÷ numero Golden

### Regole business critiche
- Lo status non retrocede MAI
- Per percepire reddito serve comunque il PV mensile del proprio status
- Tra Team Coordinator e Manager serve "intermezzo formativo" completato
- La genealogia (albero upline/downline) è la struttura portante

### Genealogia / Albero downline
- Ogni consulente ha 1 sponsor (upline diretto)
- Un consulente può avere N diretti (livello 1)
- La profondità dell'albero determina i livelli di reddito residuale
- Visualizzazione ad albero necessaria nel backoffice e nell'app

---

## MODULO 3: CHAT DI SUPPORTO AI

### Requisiti
- Chatbot basato su LLM con knowledge base InVinus
- Contesto: catalogo prodotti, piano compensi, FAQ, procedure operative
- Utenti: consulenti (domande su carriera, prodotti, provvigioni) + clienti (domande su vini, ordini)
- Integrazione con dati CRM per risposte personalizzate ("quanto mi manca per diventare Advisor?")

### Knowledge base da indicizzare
- Catalogo completo con schede prodotto
- Piano compensi con tutte le regole
- FAQ onboarding consulenti
- Procedure ordini, resi, spedizioni
- Abbinamenti cibo-vino
- Storie delle cantine

### Opzioni tecniche
- Fine-tuning modello su dati InVinus
- RAG (Retrieval Augmented Generation) con vector store
- Modello custom o API Claude/OpenAI con system prompt specializzato

---

## MODULO 4: APP MOBILE

### Funzionalità confermate
1. **Gestione Cantina personale** — il consulente/cliente gestisce la propria collezione vini
   - Inventario bottiglie possedute
   - Wishlist
   - Note degustazione personali
   - Suggerimenti abbinamento
   - Notifiche di riordino

2. **Sezione CRM mobile** (dati dal CRM via API)
   - Sintesi dashboard: PV, GV, status, team
   - Lista clienti e lead
   - Storico ordini
   - Commissioni maturate
   - Albero downline semplificato
   - Adattamento mobile delle viste desktop

### Funzionalità da definire
- Catalogo condivisibile via WhatsApp
- Link referral personalizzato
- Scanner etichetta per info vino
- Prenotazione/gestione serate
- Notifiche push (promozioni, traguardi carriera, riordini)

### Requisiti tecnici app
- **PWA (Progressive Web App)** via Next.js — web-first, installabile su telefono
- Autenticazione via Supabase Auth (JWT)
- Sincronizzazione offline per catalogo (Service Worker)
- Query DB via client Supabase (PostgREST)
- Push notifications (Web Push API)
- Futuro: se serve app nativa, React Native/Expo che consuma le stesse API Supabase

---

## MODULO 5: BACKOFFICE CONSULENTI (WEB)

### Dashboard consulente
- PV mese corrente vs. obiettivo
- GV mese corrente vs. obiettivo prossimo status
- Status attuale e progresso verso il prossimo
- Commissioni maturate nel mese (provvigione + reddito residuale + bonus)
- Storico commissioni
- Albero team con dettaglio per livello
- Ordini dei propri clienti

### Backoffice admin
- Gestione catalogo (CRUD prodotti, prezzi, disponibilità)
- Gestione consulenti (approvazione, stato, storico)
- Report vendite per periodo, regione, consulente
- Calcolo massivo provvigioni mensili
- Gestione eventi/serate
- Export dati per contabilità

---

## INTEGRAZIONI ESTERNE

| Servizio | Scopo | Priorità |
|----------|-------|----------|
| Stripe | Pagamenti online, commissioni | A (lancio) |
| Email/SMTP | Transazionali + newsletter | A |
| WhatsApp Business API | Comunicazione consulenti, condivisione catalogo | B |
| SMS gateway | Inviti serate, notifiche | B |
| Corriere (API) | Tracking spedizioni | B |
| SIAN/UTF | Compliance vendita vino online | A (legale) |
| LLM API | Chat supporto AI | B |
| Push Notifications | Firebase/APNs | B |

---

## DATI CHIAVE PER IL DIMENSIONAMENTO

| Metrica | Valore |
|---------|--------|
| Utenti anno 1 (2027) | ~150 consulenti + clienti |
| Utenti anno 3 (2029) | ~900 consulenti + clienti |
| Utenti anno 5 (2031) | ~3.600 consulenti + clienti |
| Prodotti catalogo | ~25-30 referenze |
| Ordini/mese previsti (anno 1) | ~750 (5 × 150) |
| Profondità albero max | 8 livelli |
| Regioni prodotto | 4 (Campania, Toscana, Umbria, Veneto) |
