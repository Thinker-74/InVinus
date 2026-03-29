# Procedura Init Nuovo Progetto - Per Claude Code

## Come usare questo file
1. Crea la cartella del nuovo progetto dentro `D:\Progetti\`
2. Apri un terminale DENTRO quella cartella (non dalla root!)
3. Lancia Claude Code
4. Incolla il prompt qui sotto, adattando le variabili tra [parentesi]

---

## Prompt da incollare in Claude Code

```
Inizializza questo progetto da zero con una struttura professionale e standardizzata.

## Info progetto
- Nome: [NOME_PROGETTO]
- Descrizione: [cosa fa in 1-2 frasi]
- Stack: [linguaggio, framework, database, API esterne]
- Ambiente: Windows 11, sviluppo locale
- Deploy previsto: [locale / VPS / cloud / non ancora definito]

## Cosa devi creare

### 1. Git
- Inizializza git se non esiste
- Crea un `.gitignore` completo per lo stack indicato sopra
- Includi SEMPRE: .env, __pycache__/, *.pyc, node_modules/, *.db, *.log, *.zip, .DS_Store, thumbs.db

### 2. Struttura cartelle
Crea la struttura base appropriata allo stack. Per Python:
```
src/            # codice sorgente principale
tests/          # test
config/         # configurazioni
docs/           # documentazione
logs/           # log (gitignored)
tasks/          # todo e lessons (tracciati da git)
```

### 3. CLAUDE.md (nella root del progetto)
Crea un CLAUDE.md con queste sezioni:

```markdown
# [NOME_PROGETTO]

## Panoramica
[descrizione del progetto in 2-3 righe]

## Stack
- Linguaggio: ...
- Framework: ...
- Database: ...
- API esterne: ...

## Struttura progetto
[albero delle cartelle principali con descrizione di 1 riga ciascuna]

## Comandi essenziali
- Avvio: `...`
- Test: `...`
- Lint: `...`
- Build/Deploy: `...`

## Convenzioni
- Stile codice: ...
- Naming: ...
- Lingua commit: italiano/inglese
- Branch strategy: main + feature branches

## Regole per Claude
- Usa SEMPRE plan mode per task che toccano più di 1 file
- Prima di dichiarare finito, esegui i test
- Non modificare .env, solo .env.example
- Scrivi test per ogni nuova funzionalità
- Dopo ogni correzione dell'utente, aggiorna tasks/lessons.md

## Errori noti e lezioni
Vedi `tasks/lessons.md` per la lista aggiornata.

## Stato attuale
Vedi `tasks/todo.md` per i task in corso.
```

### 4. tasks/todo.md
```markdown
# TODO - [NOME_PROGETTO]

## In corso
- [ ] Setup iniziale del progetto

## Da fare
(vuoto - si popola durante lo sviluppo)

## Completati
(vuoto)
```

### 5. tasks/lessons.md
```markdown
# Lezioni Apprese - [NOME_PROGETTO]

## Come usare questo file
Dopo ogni errore corretto dall'utente, aggiungi una riga qui sotto.
Formato: `- [DATA] ERRORE → REGOLA`

## Lezioni
(vuoto - si popola durante lo sviluppo)
```

### 6. File ambiente
- Crea `.env.example` con le variabili necessarie (valori placeholder)
- Crea `.env` copiando .env.example (sarà gitignored)

### 7. README.md
Crea un README essenziale con: descrizione, prerequisiti, installazione, avvio, struttura.

### 8. Verifica finale
- Conferma che `.claude/` esiste in questa cartella
- Conferma che NON eredita configurazioni problematiche dalla directory padre
- Mostra un riepilogo di tutti i file creati
```
