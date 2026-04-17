# M1 — Checklist di verifica pre-commit

Seguire i passi nell'ordine. Ogni step deve avere esito positivo prima di procedere al successivo.

---

## Step 1 — Eseguire 002_sync_schema.sql in produzione

1. Aprire Supabase SQL Editor per il progetto `sgqqlanflnjlkoxndssa`
2. Incollare il contenuto di `db/migrations/002_sync_schema.sql`
3. Eseguire (Run)
4. **Esito atteso:** nessun errore. La migration è idempotente: può essere rieseguita senza
   problemi su un DB che ha già le modifiche (tutti gli statement sono IF NOT EXISTS o DO $$
   con gestione exception).

---

## Step 2 — Verificare /admin/provvigioni

1. Aprire `https://invinus.vercel.app/admin/provvigioni`
2. Selezionare anno/mese di riferimento
3. Cliccare "Calcola provvigioni"
4. **Esito atteso:** 4 consulenti attivi, 1 inattivo, totale ~€203.92 (stesso risultato di M0)
5. **Se fallisce:** controllare i log Vercel — nessuna modifica toccava la route, il problema
   sarebbe precedente a M1.

---

## Step 3 — Verificare sidebar "Amministrazione"

1. Accedere con `test@invinus.it` su `https://invinus.vercel.app`
2. **Esito atteso:** la sidebar mostra la sezione "Amministrazione" (sfondo/testo rosso)
3. **Come funziona:** `Sidebar.tsx` legge `ruolo` dalla tabella `consulenti` tramite Supabase.
   Dopo la migration, la colonna è ancora `ruolo_consulente` con lo stesso valore `'admin'`
   per Francesco — nessun cambio di comportamento.

---

## Step 4 — Verificare /ref/[code] (pagina pubblica candidatura)

1. Aprire `https://invinus.vercel.app/ref/ref-fp001` (codice referral Francesco)
2. **Esito atteso:** pagina landing referral carica correttamente con profilo consulente
3. Verificare che il form di candidatura sia visibile e inviabile
4. **Opzionale:** inviare una candidatura di test e verificare che compaia in `/admin/candidature`

---

## Step 5 — Verificare assenza warning outputFileTracingRoot

1. Aprire `https://vercel.com/dashboard` → progetto InVinus → tab "Deployments"
2. Cliccare sull'ultimo deployment (triggerato automaticamente dopo il commit di M1)
3. Aprire i log di build
4. **Esito atteso:** nessuna riga contenente `outputFileTracingRoot` o `turbopack.root`
5. **Alternativa locale:** eseguire `npm run build` dalla cartella `web/` e verificare che
   il warning non compaia nell'output.

---

## Step 6 — Rigenerare tipi TypeScript (opzionale ma consigliato)

```bash
# dalla root del progetto /home/michele/Progetti/InVinus
supabase gen types typescript --linked 2>&1 | tail -n +2 > web/src/types/supabase.ts
```

Verificare che `web/src/types/supabase.ts` ora includa:
- `candidature` nella lista tabelle
- `consulente_vini_preferiti` nella lista tabelle
- Le colonne `auth_user_id`, `ruolo`, `foto_url`, `bio`, `messaggio_referral`, `specialita`
  nella definizione di `consulenti`

---

## Dopo la verifica — commit

Una volta completati tutti gli step:

```bash
git add db/schema.sql db/migrations/002_sync_schema.sql web/next.config.ts CLAUDE.md
git status   # verificare che solo questi 4 file siano staged
```

Messaggio commit suggerito:
```
chore(m1): allinea schema.sql con produzione + governance migration-first

- Aggiunge tabelle mancanti: candidature, consulente_vini_preferiti
- Aggiunge enum mancanti: stato_candidatura, ruolo_consulente
- Aggiunge colonne su consulenti: auth_user_id, ruolo, foto_url, bio,
  messaggio_referral, specialita
- Aggiunge 4 indici nuovi (auth_user_id, candidature, vini_pref)
- Aggiunge inventario 15 funzioni custom non ancora versionato (M1.5)
- Fix warning Next.js: rimuove turbopack.root ridondante da next.config.ts
- Aggiunge governance schema DB e nota terminologica in CLAUDE.md

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
