# M1.5 — Note operative per FASE 4 (deploy e verifica)

---

## Ordine di esecuzione critico

L'allineamento DB ↔ codice deve avvenire in finestra ravvicinata:

1. Merge del branch `feat/m1.5-rename` in `main` (triggera Vercel redeploy del codice aggiornato)
2. **NON APPENA Vercel mostra "Ready"**, eseguire `003_rename_consulente_incaricato.sql` in Supabase SQL Editor
3. Tra punto 1 e punto 2 c'è una finestra (~30s) in cui il codice dice "incaricati" ma il DB dice ancora "consulenti" → il sito restituisce errori. Progetto in demo interno = impatto zero.

**Alternativa più sicura:** eseguire PRIMA la migration DB e IMMEDIATAMENTE DOPO il merge+push. La finestra di disallineamento dura solo i secondi di build Vercel. Su demo interno entrambe le sequenze sono equivalenti.

---

## Checklist FASE 4

- [ ] Eseguire `003_rename_consulente_incaricato.sql` in Supabase SQL Editor (FASE 1 prima, poi FASE 2)
- [ ] `npm run build` → 0 errori TypeScript
- [ ] `npm run dev` → login come test@invinus.it
- [ ] Sidebar mostra "Gestione Incaricati"
- [ ] `/admin/incaricati` carica la lista
- [ ] `/admin/consulenti` redirige a `/admin/incaricati` (HTTP 301)
- [ ] Dashboard incaricato carica (PV/GV/status)
- [ ] `/admin/provvigioni` calcolo ancora: 4 attivi, 1 inattivo, €203.92
- [ ] Creazione ordine funziona
- [ ] `/ref/FrancescoP` ancora funziona
- [ ] `grep -r ".from(\"consulenti\")" web/src/` → 0 risultati
- [ ] `grep -r "consulente_id" web/src/` → 0 risultati (escluso prezzo_consulente)
- [ ] Merge branch + push + Vercel redeploy + smoke test produzione

---

## Post-M1.5 — Rigenerazione tipi da CLI (futura)

I tipi TypeScript in `web/src/types/supabase.ts` sono stati aggiornati manualmente in M1.5. Appena possibile, rigenerarli da CLI Supabase per evitare drift tra tipo manuale e schema reale:

```bash
supabase login
supabase link --project-ref sgqqlanflnjlkoxndssa
supabase gen types typescript --linked > web/src/types/supabase.ts
```

Idealmente questo entra nella prossima milestone come micro-task (M1.9 o integrato in M2).
