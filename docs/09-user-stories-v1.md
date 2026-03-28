# 09 — User Stories MVP (v1)

> Organizzate per persona. Priorità: P0 = MVP (senza questa non si lancia),
> P1 = entro 30 giorni dal lancio, P2 = entro 90 giorni.

---

## CONSULENTE (persona primaria)

### Vendita e catalogo
| ID | Come... | Voglio... | Per... | P |
|----|---------|-----------|--------|---|
| C01 | consulente | sfogliare il catalogo con foto, prezzi e schede | scegliere cosa proporre ai miei clienti | P0 |
| C02 | consulente | condividere un vino o il catalogo via WhatsApp con un tap | mandarlo ai miei contatti senza dover ricopiare nulla | P0 |
| C03 | consulente | avere un link referral personale | che ogni ordine fatto da quel link venga tracciato a me | P0 |
| C04 | consulente | creare un ordine per un cliente | registrare la vendita e generare i miei PV | P0 |
| C05 | consulente | vedere lo stato di spedizione di un ordine | rispondere al cliente che chiede "quando arriva?" | P1 |

### Dashboard e carriera
| ID | Come... | Voglio... | Per... | P |
|----|---------|-----------|--------|---|
| C06 | consulente | vedere i miei PV e GV del mese in tempo reale | sapere dove sono e quanto mi manca per il prossimo status | P0 |
| C07 | consulente | vedere il mio status attuale e la barra di progresso | motivarmi a raggiungere il livello successivo | P0 |
| C08 | consulente | vedere quanto ho guadagnato questo mese (breakdown) | distinguere provvigione personale da reddito residuale | P0 |
| C09 | consulente | vedere lo storico delle mie provvigioni mese per mese | fare i miei conti e pianificare | P1 |
| C10 | consulente | visualizzare il mio albero team (downline) | sapere chi c'è nei miei livelli e come stanno performando | P1 |

### Gestione cantina personale
| ID | Come... | Voglio... | Per... | P |
|----|---------|-----------|--------|---|
| C11 | consulente | aggiungere bottiglie alla mia cantina personale | tenere traccia di cosa ho in casa per le degustazioni | P1 |
| C12 | consulente | segnare una bottiglia come "consumata" o "venduta" | avere le giacenze sempre aggiornate | P1 |
| C13 | consulente | ricevere un suggerimento su cosa riordinare | non restare mai senza i vini che propongo di più | P2 |
| C14 | consulente | aggiungere note di degustazione personali a un vino | ricordarmi cosa dire ai clienti su quel vino | P2 |

### Serate e clienti
| ID | Come... | Voglio... | Per... | P |
|----|---------|-----------|--------|---|
| C15 | consulente | registrare una serata (data, luogo, partecipanti) | tracciare le mie attività e vedere i risultati | P1 |
| C16 | consulente | invitare contatti a una serata via email/WA | automatizzare l'invito invece di farlo a mano | P2 |
| C17 | consulente | vedere la lista dei miei clienti con data ultimo ordine | capire chi contattare per un riordino | P1 |
| C18 | consulente | ricevere una notifica quando un mio cliente non ordina da X giorni | non perdere clienti per disattenzione | P2 |

### Chat AI
| ID | Come... | Voglio... | Per... | P |
|----|---------|-----------|--------|---|
| C19 | consulente | chiedere "quale vino abbinare a X piatto?" | avere una risposta rapida durante una serata | P1 |
| C20 | consulente | chiedere "quanto mi manca per diventare Supervisor?" | avere la risposta esatta basata sui miei dati reali | P1 |
| C21 | consulente | chiedere "cosa proporre a un cliente che ama i bianchi?" | ricevere suggerimenti personalizzati dal catalogo | P2 |

---

## CLIENTE FINALE

| ID | Come... | Voglio... | Per... | P |
|----|---------|-----------|--------|---|
| F01 | cliente | sfogliare il catalogo e ordinare online | comprare vino senza dover aspettare una serata | P0 |
| F02 | cliente | vedere lo storico dei miei ordini | riordinare facilmente un vino che mi era piaciuto | P1 |
| F03 | cliente | gestire la mia cantina personale (cosa ho in casa) | sapere cosa bere e cosa riordinare | P2 |
| F04 | cliente | chiedere alla chat "con cosa abbino questo vino?" | avere consigli pratici senza dover cercare online | P2 |
| F05 | cliente | ricevere suggerimenti basati sui miei acquisti precedenti | scoprire nuovi vini coerenti con i miei gusti | P2 |

---

## ADMIN INVINUS

| ID | Come... | Voglio... | Per... | P |
|----|---------|-----------|--------|---|
| A01 | admin | gestire il catalogo (aggiungere/modificare/disabilitare vini) | tenere aggiornata l'offerta | P0 |
| A02 | admin | approvare nuovi consulenti | controllare chi entra nella rete | P0 |
| A03 | admin | lanciare il calcolo provvigioni del mese | generare i pagamenti per tutti i consulenti | P0 |
| A04 | admin | vedere dashboard KPI globali (fatturato, consulenti attivi, ordini) | monitorare la salute del business | P0 |
| A05 | admin | vedere il dettaglio provvigioni per singolo consulente | risolvere contestazioni e fare verifiche | P1 |
| A06 | admin | esportare dati provvigioni in CSV | passarli al commercialista | P1 |
| A07 | admin | gestire serate ed eventi (calendario globale) | coordinare l'attività della rete | P1 |
| A08 | admin | vedere l'albero genealogico completo della rete | capire la struttura e identificare leader/colli di bottiglia | P1 |
| A09 | admin | gestire listini separati (consumer vs B2B/HoReCa) | avere pricing differenziato per canale | P2 |

---

## Riepilogo MVP (solo P0)

Le feature P0 definiscono il **prodotto minimo lanciabile**:

**Backend:** catalogo prodotti, anagrafica consulenti con genealogia, ordini con tracciamento PV/GV, calcolo provvigioni mensile, auth JWT con ruoli.

**Backoffice web (admin):** CRUD catalogo, approvazione consulenti, lancio calcolo provvigioni, dashboard KPI.

**Backoffice web (consulente):** dashboard PV/GV/status, catalogo sfogliabile, crea ordine, link referral.

**App mobile (consulente):** le stesse viste P0 del backoffice consulente in formato mobile (card, semplificato).

**E-commerce (cliente):** catalogo con ordine online tramite link referral.

Tutto il resto (cantina personale, chat AI, serate, notifiche, integrazioni WA) viene in P1/P2.
