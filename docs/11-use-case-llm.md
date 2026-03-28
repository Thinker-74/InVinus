# 11 — Use Case Avanzati LLM (Prompt concreti per la Chat AI)

> Questo documento elenca i prompt ESATTI che il sistema comporrà per l'LLM.
> Per ogni use case: chi lo attiva, quale contesto serve dall'API, come si
> compone il prompt, e che formato deve avere la risposta.

---

## Architettura del prompt

Ogni richiesta alla Chat AI viene composta così:

```
[SYSTEM PROMPT]      → fisso, definisce personalità e regole (vedi doc 08)
[CONTESTO UTENTE]    → dal CRM via API: profilo, status, magazzino, clienti, storico
[CONTESTO CATALOGO]  → dal vector store via RAG: schede prodotto, abbinamenti, FAQ
[DOMANDA UTENTE]     → testo libero dell'utente
[ISTRUZIONI OUTPUT]  → formato risposta atteso (breve, lista, azione, ecc.)
```

---

## USE CASE PER CONSULENTE

### UC-1: Suggerimento vini per serata

**Trigger:** Consulente chiede "Ho una serata venerdì con 8 persone, menù di pesce, budget medio"

**Contesto necessario (API):**
- `GET /api/magazzino/:consulente_id` → scorte attuali
- `GET /api/prodotti?tipo=bianco,spumante&disponibile=true` → catalogo filtrato

**Prompt composto:**
```
L'utente è un Consulente InVinus (status: {status}).
Ha in magazzino queste bottiglie: {lista_magazzino_con_quantità}.
Il catalogo InVinus disponibile include: {schede_prodotti_filtrate_da_RAG}.

L'utente chiede: "Ho una serata venerdì con 8 persone, menù di pesce, budget medio"

Rispondi con:
1. 3-4 etichette consigliate dal suo magazzino attuale (priorità: usare ciò che ha già)
2. Se nel magazzino non ha abbastanza varietà, suggerisci 1-2 bottiglie da ordinare
3. Per ogni vino: nome, perché si abbina al pesce, temperatura di servizio
4. Stima bottiglie necessarie (8 persone ≈ 1 bottiglia ogni 2-3 persone)
Rispondi in modo conciso, adatto a mobile. Max 200 parole.
```

**Risposta attesa:**
```
Per la tua serata pesce con 8 persone ti serviranno circa 4-5 bottiglie. 
Dal tuo magazzino ti consiglio:

🐟 Vermentino Toscana IGT 2023 (ne hai 4) — fresco, agrumato, perfetto 
   con crudi e antipasti di mare. Servire a 8-10°C.

🐟 Falanghina del Sannio DOP 2024 (ne hai 3) — minerale, strutturato, 
   ottimo con primi di pesce. Servire a 8-9°C.

Ti manca un bollicine per l'aperitivo: ti consiglio di ordinare 2 bottiglie 
di Prosecco Valdobbiadene DOCG Brut (6-8°C).

[Ordina Prosecco →]
```

---

### UC-2: Analisi portafoglio clienti

**Trigger:** Consulente chiede "Chi dovrei contattare questa settimana?"

**Contesto necessario (API):**
- `GET /api/clienti?consulente_id=X&include=ultimo_ordine,totale_speso,frequenza`
- `GET /api/ordini?consulente_id=X&ultimi=90giorni`

**Prompt composto:**
```
L'utente è un Consulente InVinus (status: {status}, {N} clienti attivi).
Ecco i suoi clienti con dati rilevanti:

{tabella_clienti: nome, ultimo_ordine_data, importo_medio, frequenza_giorni, 
 preferenze_note, totale_speso_lifetime}

Regole:
- "A rischio" = ultimo ordine > 45 giorni fa E aveva frequenza < 30 giorni
- "Da riattivare" = ultimo ordine > 90 giorni fa
- "Upsell" = ordina spesso ma sempre le stesse 1-2 etichette
- "VIP" = totale speso > 500€ lifetime

Rispondi con:
1. Top 3 clienti da contattare QUESTA SETTIMANA, in ordine di priorità
2. Per ognuno: perché contattarlo, cosa proporre, script suggerito (1-2 frasi WA)
Rispondi in modo conciso, adatto a mobile. Max 250 parole.
```

**Risposta attesa:**
```
Questa settimana concentrati su questi 3:

1. 🔴 Maria R. — non ordina da 52 giorni (prima ordinava ogni 3 settimane).
   Proponi: il nuovo Trebbiano Spoletino che non ha mai provato.
   WA: "Ciao Maria! È arrivato un bianco umbro che devi assolutamente 
   provare, fresco e minerale. Ti mando la scheda?"

2. 🟡 Luca B. — ordina regolarmente ma sempre e solo Chianti Classico.
   Proponi: Brunello di Montalcino (upgrade naturale, stessa regione).
   WA: "Luca, se ti piace il Chianti devi provare questo Brunello 2021, 
   è il fratello maggiore. Te ne metto una in consegna?"

3. ⭐ Anna M. — VIP (680€ lifetime), ultimo ordine 20gg fa, potrebbe 
   essere interessata alla serata di venerdì.
   WA: "Anna, venerdì faccio una degustazione con 3 etichette nuove 
   toscane. Ti tengo un posto?"
```

---

### UC-3: Stato carriera e coaching

**Trigger:** Consulente chiede "Quanto mi manca per diventare Supervisor?"

**Contesto necessario (API):**
- `GET /api/consulenti/:id/dashboard` → PV, GV, status, team
- Tabella qualifiche (dal vector store o config DB)

**Prompt composto:**
```
L'utente è un Consulente InVinus.
Status attuale: {status} (es. ADVISOR)
PV mese corrente: {pv} (requisito mantenimento: {pv_req})
GV mese corrente: {gv}
Prossimo status: {prossimo_status} (requisito: {pv_prossimo} PV, {gv_prossimo} GV)
Team attuale: {n_diretti} diretti al Livello 1, {n_totali} totali

Rispondi con:
1. Stato attuale in modo chiaro (sei qui, ti manca questo)
2. Suggerimento concreto su come raggiungere il prossimo status
3. Non promettere guadagni specifici (compliance NM)
Tono: motivante ma realistico. Max 150 parole.
```

**Risposta attesa:**
```
Sei Advisor con 50 PV e 320 GV questo mese. Per diventare Supervisor 
ti servono 500 GV — ti mancano 180 GV.

Concretamente: se ognuno dei tuoi 4 diretti facesse 2 vendite in più 
questo mese (circa 45 PV ciascuno), saresti a 500 GV.

💡 Suggerimento: organizza una mini-call di team questa settimana e 
proponi una "sfida 2 vendite" — magari con il Prosecco Valdobbiadene 
che è facile da proporre come regalo. I tuoi diretti ci guadagnano 
in provvigioni e tu avanzi di status.

PV personali: ✅ 50/50 (requisito OK)
GV team: 🟡 320/500 (mancano 180)
```

---

### UC-4: Preparazione serata con analisi invitati

**Trigger:** Consulente chiede "Preparo la serata di sabato, ho invitato 6 persone. Cosa porto?"

**Contesto necessario (API):**
- `GET /api/magazzino/:consulente_id` → scorte
- `GET /api/eventi/:evento_id` → dettagli serata + partecipanti (se registrati)
- Catalogo prodotti (RAG)

**Prompt composto:**
```
Il Consulente sta preparando una serata degustazione.
Dettagli: {data}, {luogo}, {n_partecipanti} partecipanti.
Suo magazzino: {lista_scorte}.
Partecipanti noti (se sono già clienti): {storico_preferenze_partecipanti}.

Suggerisci:
1. Selezione di 4-5 vini per la degustazione (mix tipi, dal suo magazzino se possibile)
2. Ordine di servizio (dal più leggero al più strutturato)
3. Abbinamenti cibo semplici per ogni vino
4. Quantità: calcola in base al numero di partecipanti
5. Se mancano bottiglie: cosa ordinare e entro quando
Max 300 parole, formato lista pratica.
```

---

## USE CASE PER CLIENTE FINALE

### UC-5: Consiglio vino per occasione

**Trigger:** Cliente chiede "Cosa porto a una cena con arrosto di vitello?"

**Contesto necessario:**
- Catalogo (RAG) — solo schede prodotto
- Storico acquisti cliente (API, se autenticato)

**Prompt composto:**
```
L'utente è un Cliente InVinus.
{SE autenticato: "Ha già acquistato: {storico_vini}. Preferenze note: {preferenze}"}
{SE non autenticato: "Nessun dato storico disponibile."}

Catalogo disponibile: {schede_prodotti_pertinenti_da_RAG}

Domanda: "Cosa porto a una cena con arrosto di vitello?"

Rispondi con:
1. 2-3 vini dal catalogo InVinus perfetti per l'arrosto
2. Per ognuno: nome, perché si abbina, prezzo, temperatura
3. Se ha già comprato uno di questi, menzionalo ("lo conosci già!")
4. Link per ordinare
Tono: appassionato ma non tecnico. Max 150 parole.
```

---

### UC-6: "Cosa bevo stasera?" (dalla cantina personale)

**Trigger:** Cliente apre chat dalla sezione Cantina e chiede "Ho voglia di un rosso, cosa apro?"

**Contesto necessario (API):**
- `GET /api/cantina?utente_id=X&stato=IN_CANTINA&tipo=rosso`

**Prompt composto:**
```
L'utente ha questi rossi nella sua cantina personale:
{lista_vini_in_cantina_con_note_personali}

Domanda: "Ho voglia di un rosso, cosa apro?"

Suggerisci 1 vino dalla SUA cantina con:
- Perché quello (basato su stagione, temperatura esterna se disponibile, note precedenti)
- Temperatura di servizio
- Abbinamento cena veloce
- Se ha scritto note su quel vino, richiamale ("l'ultima volta l'hai trovato 'fantastico'")
Max 80 parole. Tono amichevole e intimo.
```

---

## USE CASE ADMIN / ANALYTICS

### UC-7: Report intelligente performance rete

**Trigger:** Admin chiede "Come sta andando la rete questo mese?"

**Contesto necessario (API):**
- `GET /api/admin/kpi?mese=corrente` → fatturato, ordini, consulenti attivi, nuovi iscritti
- `GET /api/admin/kpi?mese=precedente` → per confronto
- `GET /api/consulenti?top=5&ordinaPer=pv_mese` → top performer
- `GET /api/consulenti?attivi=false&ultimi_attivi=true` → chi ha smesso

**Prompt composto:**
```
Dati mese corrente vs precedente:
{tabella_kpi_confronto}

Top 5 consulenti: {lista}
Consulenti diventati inattivi: {lista}
Nuovi iscritti: {lista}

Genera un report di 200 parole con:
1. Trend positivi (cosa va bene)
2. Segnali di allarme (cosa peggiora)
3. 2 azioni suggerite per il prossimo mese
Tono: analitico, diretto, orientato all'azione.
```

---

## Regole LLM trasversali (per tutti gli use case)

### Cosa l'LLM deve SEMPRE fare
- Usare SOLO vini presenti nel catalogo InVinus (mai inventare)
- Includere temperatura di servizio quando consiglia un vino
- Quando suggerisce un ordine, includere un CTA/link
- Se non ha dati sufficienti, chiedere anziché inventare
- Rispondere nella lingua dell'utente

### Cosa l'LLM NON deve MAI fare
- Promettere guadagni specifici ("guadagnerai 2.000€/mese")
- Consigliare vini di altri brand/cantine non in catalogo
- Dare consigli medici sull'alcol
- Condividere dati di un consulente/cliente con un altro
- Rispondere a domande fuori dominio (politica, sport, ecc.) — redirigere gentilmente

### Linee rosse compliance (vino + network marketing italiano)

Queste regole sono NON NEGOZIABILI. Se il prompt dell'utente le attiva, l'LLM rifiuta gentilmente.

**Compliance NM / vendita diretta:**
- MAI promettere redditi specifici o range di guadagno ("puoi fare 500-2000€/mese")
- MAI usare formule tipo "reddito passivo", "libertà finanziaria", "guadagna mentre dormi"
- MAI suggerire che il reclutamento è più importante della vendita di prodotto
- MAI confrontare guadagni InVinus con stipendi da lavoro dipendente
- OK dire: "le provvigioni dipendono esclusivamente dalla mole di lavoro di ogni singolo Consulente"
- OK mostrare i dati reali dell'utente ("questo mese hai guadagnato X€")

**Compliance vino / alcol:**
- MAI attribuire proprietà salutistiche al vino ("fa bene al cuore", "antiossidante")
- MAI suggerire consumo a minori o incoraggiare consumo eccessivo
- MAI associare vino a guida o attività pericolose
- Se l'utente chiede "quanto vino posso bere?", rispondere: "Non posso dare consigli medici. Per informazioni sul consumo responsabile, consulta il tuo medico."
- OK parlare di caratteristiche organolettiche, terroir, abbinamenti, storie delle cantine

**Compliance contenuti social (per UC-5 tipo "genera post IG"):**
- Ogni post deve includere: #ad o #pubblicità se promuove vendita
- MAI screenshot di provvigioni / bonifici (anche se l'utente li fornisce)
- Tono dark-luxury: niente linguaggio da televendita, niente maiuscole aggressive, niente "OFFERTA LIMITATA!!!"

### Personalizzazione per canale
| Canale | Max parole | Formato | Emoji |
|--------|-----------|---------|-------|
| App mobile | 150 | Card con bullet | Sì, moderato |
| Web desktop | 300 | Paragrafi + lista | Opzionale |
| WhatsApp (se integrato) | 100 | Testo puro | Sì |

### Fallback
Se l'LLM non riesce a rispondere (domanda troppo vaga, dati mancanti):
```
"Non ho abbastanza informazioni per darti un consiglio preciso. 
Puoi dirmi di più su [occasione/preferenze/budget]? 
Oppure contatta il tuo consulente InVinus: [link/nome]."
```
