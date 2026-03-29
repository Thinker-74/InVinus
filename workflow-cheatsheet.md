# Workflow Quotidiano - Cheat Sheet

## Regola d'oro
Lancia Claude Code SEMPRE dalla cartella del progetto, MAI da `D:\Progetti`.

---

## Inizio sessione
Quando apri Claude Code su un progetto, inizia sempre con:
```
Leggi CLAUDE.md e tasks/lessons.md. Poi mostrami lo stato di tasks/todo.md.
```

## Durante lo sviluppo

### Per task semplici (1 file, fix ovvio)
Procedi direttamente, nessun overhead.

### Per task complessi (2+ file, decisioni architetturali)
```
Entra in plan mode. Devo [descrizione del task]. 
Proponimi un piano prima di implementare.
```

### Dopo una correzione tua a Claude
```
Aggiorna tasks/lessons.md con quello che hai sbagliato e la regola per evitarlo.
```

### Quando un task è completato
```
Segna [task] come completato in tasks/todo.md. 
Esegui i test per confermare che tutto funziona.
```

## Fine sessione
```
Aggiorna tasks/todo.md con lo stato attuale. 
Se ci sono lezioni nuove da questa sessione, aggiungile a tasks/lessons.md.
```

---

## Cose da NON fare
- Non lanciare Claude Code da `D:\Progetti` (root) per lavorare su un singolo progetto
- Non copiare CLAUDE.md tra progetti — ogni progetto ha il suo
- Non ignorare gli errori di Claude — ogni correzione è una lezione da salvare
- Non saltare i test prima di dichiarare finito
