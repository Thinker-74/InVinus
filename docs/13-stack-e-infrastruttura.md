# 13 — Stack Tecnologico & Infrastruttura

> Vincoli reali: sviluppatore solo con Claude Code, competenze sysadmin/networking,
> budget infrastruttura minimo (usare quello che c'è), open source dove possibile.
> Questo documento sceglie lo stack e spiega PERCHÉ ogni pezzo.

---

## Principio guida: meno pezzi = meno cose che si rompono

Da solo con Claude Code, ogni servizio in più è un servizio da mantenere, aggiornare,
debuggare alle 2 di notte. Lo stack deve avere il minor numero possibile di componenti,
ognuno che fa più cose, e possibilmente con un free tier che basta per il primo anno.

---

## 5 decisioni congelate (non si ridiscutono fino alla Fase 2)

| # | Decisione | Scelta | Perché |
|---|-----------|--------|--------|
| 1 | Managed o self-hosted? | **Managed** (Supabase + Vercel) | Da solo non hai tempo per DevOps. Coolify/VPS = Fase 2 |
| 2 | Supabase sì/no? | **Sì** | DB + Auth + API + Storage in un colpo, free tier generoso |
| 3 | Admin catalogo custom o tool? | **Directus** per admin dati + custom per logica business | Directus gestisce catalogo/consulenti in 10 min, provvigioni restano custom |
| 4 | Mobile subito o web-first? | **Web-first (PWA)** | Una codebase, zero app store, installabile su telefono |
| 5 | LLM in MVP o predisposto? | **Predisposto in MVP, operativo in P1** | L'endpoint /api/chat esiste ma la chat è un layer separato, non logica core |

### Principio architetturale LLM
Il layer AI è **separato** dal core gestionale. Il CRM espone API pulite;
il modulo chat legge da quelle API + knowledge base. La logica di business
critica (provvigioni, ordini, carriera) NON vive nel layer LLM.

---

## Lo stack raccomandato

```
┌─────────────────────────────────────────────────────────┐
│                    COSA VEDE L'UTENTE                    │
│                                                          │
│  Browser desktop → Backoffice admin/consulente           │
│  Browser mobile  → App (PWA installabile, no app store)  │
│  Chat widget     → Chat AI integrata                     │
│                                                          │
│  Tutto è UNA sola web app responsive (Next.js)           │
├──────────────────────────────────────────────────────────┤
│                    BACKEND + DATABASE                     │
│                                                          │
│  Supabase (free tier)                                    │
│  ├── PostgreSQL          (il DB che hai già progettato)  │
│  ├── Auth                (login, JWT, ruoli — gratis)    │
│  ├── REST API auto       (CRUD gratis su ogni tabella)   │
│  ├── Edge Functions      (logica custom: provvigioni)    │
│  ├── Storage             (immagini prodotti, documenti)  │
│  └── Realtime            (notifiche live, opzionale)     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                    CHAT AI                                │
│                                                          │
│  API Claude (già paghi l'abbonamento Pro)                │
│  Contesto: catalogo + FAQ in system prompt               │
│  Dati utente: query Supabase dentro la Edge Function     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                    HOSTING FRONTEND                       │
│                                                          │
│  Vercel (free tier) OPPURE il tuo hosting condiviso      │
│  (se supporta Node.js)                                   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                    PAGAMENTI                              │
│                                                          │
│  Stripe (commissione % sulle transazioni, no fisso)      │
└──────────────────────────────────────────────────────────┘
```

---

## Perché ogni pezzo

### 1. Supabase (sostituisce: database + backend API + auth + storage)

**Cos'è:** PostgreSQL gestito + API REST automatiche + autenticazione + storage. Open source.
**Perché:** Invece di installare PostgreSQL, scrivere un backend Express/FastAPI, implementare
JWT da zero e gestire upload file, Supabase ti dà tutto in un unico servizio. Lo schema SQL
che hai già generato (729 righe) funziona direttamente su Supabase.

**Free tier (più che sufficiente per il primo anno):**
- 500 MB database (150 consulenti + 30 prodotti = meno di 10 MB)
- 1 GB storage (immagini prodotti)
- 50.000 utenti attivi al mese
- API illimitate
- 500.000 invocazioni Edge Functions/mese

**Quando pagherai:** quando superi i 500 MB di DB o 50K utenti. Piano Pro = 25$/mese.
Con la crescita prevista (150 utenti anno 1), il free tier basta almeno 12-18 mesi.

**URL:** https://supabase.com — crea un account e un progetto "invinus"

### 2. Next.js (sostituisce: frontend web + app mobile + backoffice)

**Cos'è:** Framework React per web app. Open source.
**Perché:** Una sola codebase per tutto: desktop (backoffice admin), desktop (backoffice consulente),
mobile (PWA installabile). Claude Code lo genera molto bene.

**PWA al posto di app nativa — perché per ora è la scelta giusta:**

| Aspetto | App nativa (Flutter/RN) | PWA (Next.js) |
|---------|------------------------|---------------|
| Costi app store | 99€/anno Apple + 25€ Google | 0€ |
| Tempo sviluppo | x2 (due piattaforme) | x1 (una codebase) |
| Installabile su telefono? | Sì | Sì (Add to Home Screen) |
| Push notifications | Sì | Sì (Web Push, supportato) |
| Accesso offline? | Sì | Sì (Service Worker) |
| Pubblicazione | Review Apple (2-7 giorni) | Deploy immediato |
| Quando serve davvero nativa? | Fotocamera avanzata, NFC, Bluetooth | InVinus non ne ha bisogno ora |

**Regola:** parti PWA. Se tra 12 mesi hai 500+ consulenti che chiedono "app nativa",
a quel punto avrai budget e dati per giustificare Flutter/React Native.

### 3. API Claude per la Chat AI

**Cos'è:** L'API dello stesso Claude che usi in Claude.ai. Il tuo abbonamento Pro
non include l'API — serve un account API separato (pay-per-use).

**Costi reali per InVinus:**
- Input: ~3$/1M token, Output: ~15$/1M token (Claude Sonnet)
- Una domanda chat media = ~2.000 token totali = ~0,003$
- 150 consulenti × 5 domande/giorno × 30 giorni = 22.500 domande/mese ≈ 7-10$/mese
- Anno 1: stimare 10-15$/mese

**Alternativa gratis (per partire):** usare un modello open source locale (Llama, Mistral)
tramite Ollama sul tuo server/VPS. Ma richiede più setup e i risultati sono inferiori.
Suggerimento: parti con API Claude (costa poco), valuta open source dopo.

**URL:** https://console.anthropic.com — crea un account API

### 4. Vercel per hosting frontend

**Cos'è:** Hosting ottimizzato per Next.js. Del team che ha creato Next.js.
**Perché:** Deploy con `git push`. Free tier generoso.

**Free tier:**
- 100 GB bandwidth/mese
- Serverless functions incluse
- Deploy automatico da GitHub
- HTTPS automatico
- Custom domain gratuito

**Alternativa:** se il tuo hosting condiviso supporta Node.js (verifica con il provider),
puoi hostare lì. Ma la maggior parte degli hosting condivisi italiani supporta solo PHP/MySQL.

### 5. Stripe per pagamenti

**Cos'è:** Gateway di pagamento. Lo usi già (è nel business plan).
**Costi:** 1,4% + 0,25€ per transazione (nessun costo fisso mensile).
**Setup:** crea account su stripe.com, ottieni API keys, integra nel checkout.

### 6. Directus per admin catalogo/dati (opzionale ma consigliato)

**Cos'è:** Headless CMS open source. Si collega al tuo PostgreSQL (quello di Supabase)
e genera automaticamente un pannello admin per gestire i dati. Zero codice.
**Perché:** Invece di sviluppare da zero le schermate admin per: aggiungere un vino al catalogo,
cambiare un prezzo, disabilitare un prodotto, modificare i dati di un consulente, gestire le
cantine fornitrici — Directus le genera in automatico leggendo le tabelle del DB.

**Cosa gestisce Directus (zero sviluppo):**
- CRUD catalogo prodotti (aggiungi vino, modifica prezzo, upload foto)
- Gestione cantine fornitrici
- Visualizzazione/modifica consulenti e clienti
- Gestione box degustazione
- Qualsiasi dato "piatto" (tabelle senza logica complessa)

**Cosa NON gestisce Directus (resta custom):**
- Calcolo provvigioni (logica troppo complessa)
- Dashboard consulente con PV/GV in tempo reale
- Chat AI
- Albero genealogico interattivo
- Checkout/pagamenti Stripe

**Come si integra:**
```
Supabase PostgreSQL ← (stesso DB) → Directus (admin dati)
                    ← (stesso DB) → Next.js (frontend utente)
                    ← (stesso DB) → Edge Functions (logica business)
```
Directus legge e scrive sullo stesso PostgreSQL di Supabase. Non duplica nulla.

**Hosting Directus:**
- Free tier Directus Cloud: 1 progetto, 5.000 chiamate API/mese (basta per admin)
- Oppure self-hosted gratuito (Docker sul tuo hosting se supporta container)
- Oppure su Railway.app (free tier: 500 ore/mese)

**URL:** https://directus.io — crea account o installa self-hosted

**Quando aggiungerlo:** non al giorno 1. Prima fai funzionare Supabase + Next.js.
Quando inizi a stancarti di gestire il catalogo via SQL Editor di Supabase, installi Directus.

---

## Costo totale infrastruttura — Anno 1

| Servizio | Costo mensile | Note |
|----------|--------------|------|
| Supabase | 0€ | Free tier, basta per ~18 mesi |
| Vercel | 0€ | Free tier, basta per ~12 mesi |
| API Claude (chat) | ~10-15€ | Pay-per-use, scala con l'uso |
| Stripe | 0€ fisso | Solo commissioni % sulle vendite |
| Directus | 0€ | Cloud free tier o self-hosted |
| Dominio invinus.it/com | ~1€/mese | Se non ce l'hai già |
| **TOTALE** | **~15€/mese** | Primi 150 consulenti |

Quando cresci (anno 2, 450 consulenti):

| Servizio | Costo mensile |
|----------|--------------|
| Supabase Pro | 25$ (~23€) |
| Vercel Pro | 20$ (~18€) |
| API Claude | ~30-40€ |
| Directus (se serve Pro) | 0-15€ |
| **TOTALE** | **~80-95€/mese** |

---

## Setup iniziale — cosa fare in ordine

### Step 1: Accounts (30 minuti)
```
1. Supabase    → https://supabase.com → Sign up → New Project "invinus"
2. Vercel      → https://vercel.com → Sign up con GitHub
3. GitHub      → crea repo "invinus" (privato)
4. Stripe      → https://stripe.com → crea account (anche in test mode)
5. Anthropic   → https://console.anthropic.com → crea account API
```

### Step 2: Database (10 minuti)
```
1. Vai su Supabase → SQL Editor
2. Incolla il file db/schema.sql (le 729 righe già generate da Claude Code)
3. Esegui → hai il DB completo con seed data
```

### Step 3: Progetto Next.js (in Claude Code)
```bash
cd ~/invinus
npx create-next-app@latest web --typescript --tailwind --app --src-dir
cd web
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs stripe
```

### Step 4: Connessione Supabase
```
1. Da Supabase → Settings → API → copia URL e anon key
2. Crea file web/.env.local:

NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  (questa è segreta, solo server-side)
STRIPE_SECRET_KEY=sk_test_...
ANTHROPIC_API_KEY=sk-ant-...
```

### Step 5: primo prompt a Claude Code
```
Il progetto usa:
- Supabase (PostgreSQL + Auth + REST API + Edge Functions)
- Next.js 14+ con App Router e TypeScript
- Tailwind CSS per styling (tema dark luxury: nero, oro #C8A85C, bianco)
- Stripe per pagamenti
- API Claude (Sonnet) per la chat AI

Lo schema DB è già su Supabase (dal file db/schema.sql).

Crea la struttura base dell'app Next.js con:
1. Layout dark luxury (sfondo nero, accenti oro, font premium)
2. Auth con Supabase (login consulente + login admin)
3. Dashboard consulente: PV, GV, status, barra progresso
4. Pagina catalogo con i 30 prodotti dal DB

Usa il client Supabase per le query, non scrivere API custom per il CRUD base.
```

---

## Cosa Supabase ti regala (e non devi sviluppare)

| Funzionalità | Senza Supabase (fai tutto tu) | Con Supabase |
|---|---|---|
| Login/registrazione | Implementi JWT, bcrypt, refresh token, reset password | 3 righe di codice |
| API CRUD per ogni tabella | Scrivi route Express/FastAPI per ogni entità | Automatico (PostgREST) |
| Upload immagini prodotti | Configuri S3/disk, scrivi upload handler | `supabase.storage.upload()` |
| Row Level Security | Scrivi middleware auth per ogni endpoint | Policy SQL dichiarative |
| Realtime (notifiche live) | Implementi WebSocket server | Attivi un flag sulla tabella |
| Backup database | Configuri pg_dump + cron | Automatico (giornaliero) |

**Il risparmio vero:** non è sui soldi, è sulle **settimane di sviluppo** che non devi fare.
Da solo con Claude Code, ogni settimana risparmiata è critica.

---

## Logica custom (quello che Supabase NON fa per te)

Queste cose le devi comunque scrivere, e sono il cuore del valore InVinus:

| Cosa | Dove | Come |
|------|------|------|
| Calcolo provvigioni multilivello | Supabase Edge Function | TypeScript, job mensile |
| Percorso albero genealogico | Supabase Edge Function o query SQL ricorsiva | CTE PostgreSQL |
| Chat AI con contesto utente | Supabase Edge Function | Chiama API Claude con contesto |
| Alert scorta bassa cantina | Supabase Edge Function (cron) | Query + push notification |
| Logica Stripe checkout | Next.js API Route | Stripe SDK |
| Generazione link referral | Supabase Edge Function | UUID + associazione consulente |

Le Edge Functions di Supabase sono essenzialmente serverless functions in TypeScript
(basate su Deno). Claude Code le genera perfettamente.

---

## Quando migrare (non ora, ma sappi che esiste la via)

### Fase 1 → Fase 2: primo scale-up

| Trigger | Cosa fare | Costo |
|---------|-----------|-------|
| >500 MB database | Passa a Supabase Pro | 25$/mese |
| >50K utenti/mese | Passa a Supabase Pro | idem |
| Admin catalogo scomodo via SQL | Aggiungi Directus | 0€ (self-hosted) |
| Vuoi più controllo sui deploy | Aggiungi Coolify su VPS | VPS Hetzner 5€/mese |

### Fase 2 → Fase 3: indipendenza completa (se serve)

| Trigger | Cosa fare | Costo |
|---------|-----------|-------|
| Vuoi uscire da Supabase managed | VPS (Hetzner/OVH) + Supabase self-hosted via Docker | 10-20€/mese |
| Vuoi uscire da Vercel | Coolify sullo stesso VPS (PaaS self-hosted, open source) | 0€ extra |
| Consulenti chiedono app nativa | Aggiungi React Native/Expo (stesse API Supabase) | Tempo dev |
| Serve on-premise (GDPR estremo) | Tutto su tuo server fisico | Costo hw |

### Cos'è Coolify (per quando servirà)
Coolify è una piattaforma PaaS open source auto-hostata — in pratica è un "Vercel/Heroku
che gira sul tuo VPS". Installi Coolify su un server Hetzner da 5€/mese e da lì fai deploy
di Next.js, Supabase self-hosted, Directus, qualsiasi cosa con Docker. Interfaccia web,
deploy con git push, certificati SSL automatici. È la via di uscita naturale quando
i costi managed superano un VPS dedicato.

**URL:** https://coolify.io

### Perché non serve ora
Con 150 utenti e ~15€/mese di costi managed, non ha senso spendere ore a configurare
Docker + Coolify + backup + monitoring. Lo fai quando i costi managed superano i 100€/mese
E hai 1.000+ utenti. Quel giorno, il codice che hai scritto funziona identicamente:
Supabase è open source, Next.js è lo stesso, le Edge Functions diventano container Docker.

Zero lock-in su ogni componente. Questa è la via d'uscita reale.

---

## Riepilogo stack in una frase

**Supabase (gratis) fa il lavoro pesante (DB, auth, API, storage).
Next.js (gratis su Vercel) fa tutto il frontend (desktop, mobile PWA, backoffice).
Directus (gratis) gestisce l'admin del catalogo senza scrivere codice.
Tu con Claude Code scrivi solo la logica di business: provvigioni, chat AI, cantina.**

Tutto il resto è già fatto. E quando crescerai, migri su VPS + Coolify con lo stesso codice.
