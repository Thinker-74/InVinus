# 10 — Modello Dati Cantina & Magazzino Consulente

> Questo documento definisce cosa significa "cantina" in InVinus, cosa tracciare,
> e la logica di scorta/rotazione/alert. Senza questo doc, un developer implementa
> un generico "inventario bottiglie" che non serve a nessuno.

---

## Due "cantine" diverse nel sistema

InVinus ha bisogno di distinguere due concetti che usano la parola "cantina":

### 1. Cantina Personale (wine lover / cliente)
**Scopo:** "Cosa ho in casa da bere"
- Traccia bottiglie possedute a scopo personale
- Note degustazione, punteggi soggettivi, wishlist
- Non ha impatto su PV/GV
- Funzionalità lifestyle, crea engagement e retention

### 2. Magazzino Operativo Consulente
**Scopo:** "Cosa ho disponibile per vendere e per le serate"
- Traccia scorte di lavoro: bottiglie per degustazioni, campioni, box pronti
- Ha impatto diretto sul business: se finiscono le bottiglie, non può fare serate
- Alert riordino, scorta minima, rotazione
- Collegato a ordini di approvvigionamento dal magazzino centrale InVinus

**Il consulente ha ENTRAMBE.** Può avere 3 Brunello "per casa" (cantina personale)
e 12 Brunello "per le serate di questa settimana" (magazzino operativo).

---

## Modello dati

### Cantina Personale (per clienti E consulenti)

```
CantinaPers {
  id
  utente_id          → FK (Consulente o Cliente)
  utente_tipo        → enum [CONSULENTE, CLIENTE]
  prodotto_id        → FK Prodotto
  quantita           → int (bottiglie)
  stato              → enum [IN_CANTINA, CONSUMATA, REGALATA]
  data_aggiunta
  data_consumo       → nullable
  nota_degustazione  → text (libera)
  punteggio_personale → int 1-5 (stelle, opzionale)
  occasione          → text ("cena anniversario", "aperitivo amici")
  in_wishlist        → boolean (se true: non la possiede, la desidera)
}
```

### Magazzino Operativo Consulente

```
MagazzinoConsulente {
  id
  consulente_id      → FK Consulente
  prodotto_id        → FK Prodotto
  quantita_disponibile → int
  quantita_riservata   → int (prenotate per serate future)
  scorta_minima        → int (soglia sotto cui scatta alert)
  data_ultimo_carico   → date (ultimo approvvigionamento)
  data_ultima_uscita   → date (ultima vendita/degustazione)
  origine              → enum [ACQUISTO_PERSONALE, CAMPIONE_GRATUITO, OMAGGIO_PROMO, STARTER_KIT]
}

MovimentoMagazzino {
  id
  magazzino_id       → FK MagazzinoConsulente
  tipo               → enum [CARICO, VENDITA, DEGUSTAZIONE, OMAGGIO, RESO, ROTTURA, AUTOCONSUMO]
  quantita           → int (positivo per carico, negativo per uscita)
  data
  riferimento_id     → nullable (ordine_id se vendita, evento_id se degustazione)
  note               → text
}
```

---

## Cosa tracciare e perché

### Tipi di bottiglia nel magazzino consulente

| Tipo | Come entra | Come esce | Genera PV? | Note |
|------|-----------|-----------|------------|------|
| **Acquisto personale** | Consulente ordina dal catalogo InVinus | Vendita a cliente, degustazione, autoconsumo | Sì (all'acquisto) | Il caso più comune |
| **Box degustazione** | Ordinato come kit pre-composto (3-6 bottiglie) | Aperto durante una serata | Sì (all'acquisto del box) | Potrebbe avere prezzo speciale |
| **Campione gratuito** | Inviato da InVinus per lancio nuova etichetta | Degustazione, omaggio a cliente top | No | Tracciare separatamente per costo aziendale |
| **Omaggio promo** | Bonus per traguardi (es. "10 vendite = 1 bottiglia gratis") | Libero uso consulente | No | Programma incentivi |
| **Starter Kit** | Incluso nel kit iniziale del consulente | Degustazione alla prima serata | Incluso nel prezzo kit | Contenuto kit da definire |

### Tipi di uscita

| Uscita | Significato | Impatto sistema |
|--------|-------------|-----------------|
| **Vendita** | Bottiglia venduta a cliente finale | Genera ordine → PV (ma i PV sono già contati sull'ordine cliente, non sull'uscita magazzino) |
| **Degustazione** | Aperta durante serata/wine party | Collegata a evento_id, è un costo operativo del consulente |
| **Omaggio** | Regalata a cliente per fidelizzazione | Nessun PV, tracciare come costo promozionale |
| **Autoconsumo** | Consulente la beve per sé | Può generare PV se acquistata da InVinus |
| **Reso** | Restituita (difetto, rottura pre-vendita) | Vedi doc 12 per gestione resi |
| **Rottura** | Rotta durante trasporto/stoccaggio | Loss tracking |

---

## Rotazione: cosa significa per InVinus

"Rotazione" nel contesto InVinus non è la rotazione di magazzino industriale. Significa:

### Per il consulente
> "Quanto velocemente vendo/uso le bottiglie che ho comprato?"

**Calcolo:**
```
rotazione_prodotto = uscite_ultimi_90_giorni / giacenza_media_90_giorni
```

**Interpretazione:**
- Rotazione alta (>2): il consulente vende questo vino velocemente → suggerire di tenerne di più
- Rotazione media (0.5-2): equilibrio sano
- Rotazione bassa (<0.5): il vino resta in magazzino → forse non lo propone, o non piace ai suoi clienti
- Rotazione zero: mai venduto/usato → alert "hai ancora 6 bottiglie di X, vuoi provare a proporlo?"

### Per l'admin InVinus (magazzino centrale)
> "Quali etichette si muovono? Quali sono ferme?"

**Utilizzo:**
- Decidere quali vini promuovere nelle serate
- Identificare etichette da ruotare/sostituire nel catalogo
- Pianificare riordini dalle cantine fornitrici

---

## Scorta minima e alert riordino

### Come funziona

Ogni consulente ha una **scorta minima** per prodotto, che può essere:
1. **Impostata manualmente** dal consulente ("voglio avere sempre almeno 6 Falanghina")
2. **Suggerita dal sistema** in base alla rotazione ("vendi 4 Falanghina/mese → scorta minima suggerita: 6")

### Logica alert

```
SE quantita_disponibile - quantita_riservata <= scorta_minima:
    → Notifica push: "Scorta bassa: ti restano solo X [nome vino]. Vuoi riordinare?"
    → Badge nell'app sulla sezione cantina
    → Opzionale: link diretto per riordinare con 1 tap

SE quantita_disponibile == 0 E rotazione_ultimi_90g > 0:
    → Notifica push: "Hai finito [nome vino] che vendevi spesso. Riordina?"

SE data_ultima_uscita > 60 giorni E quantita_disponibile > 0:
    → Suggerimento: "Hai [X] bottiglie di [nome] ferme da 2 mesi. 
       Prova a proporlo alla prossima serata con abbinamento [suggerimento LLM]"
```

### Soglie suggerite (default, personalizzabili)

| Profilo consulente | Scorta minima default per etichetta |
|--------------------|-------------------------------------|
| Starter (1-2 serate/mese) | 2 bottiglie |
| Attivo (4+ serate/mese) | 6 bottiglie |
| Top performer (8+ serate/mese) | 12 bottiglie |

---

## Integrazione con altri moduli

| Modulo | Relazione con Cantina/Magazzino |
|--------|--------------------------------|
| **Ordini** | Quando il consulente ordina per sé → carico magazzino. Quando vende a cliente → uscita (se era in magazzino) |
| **Eventi/Serate** | Al termine di una serata, il consulente scarica le bottiglie aperte come "degustazione" |
| **Chat AI** | L'LLM vede il magazzino per suggerire: "Per la serata di venerdì hai abbastanza rossi?" |
| **Provvigioni** | I PV sono sull'ordine, non sul movimento di magazzino. Il magazzino è operativo, non contabile |
| **Dashboard** | Widget "stato scorte" con semaforo verde/giallo/rosso per etichetta |

---

## Schema DB aggiuntivo

### Vincoli di integrità (regole critiche per il DB)

```
REGOLA 1: quantita_disponibile >= 0 SEMPRE (non si può avere stock negativo)
REGOLA 2: quantita_riservata <= quantita_disponibile (non riservare più di quanto hai)
REGOLA 3: ogni MOVIMENTO deve aggiornare quantita_disponibile nella stessa transazione
REGOLA 4: movimenti di uscita (VENDITA, DEGUSTAZIONE, ecc.) falliscono se porterebbero stock < 0
REGOLA 5: scorta_minima >= 0, default 2 per etichette core, 0 per campioni/omaggi
```

```sql
-- Cantina personale (wine lover)
CREATE TABLE cantina_personale (
  id SERIAL PRIMARY KEY,
  utente_id INT NOT NULL,
  utente_tipo VARCHAR(20) NOT NULL CHECK (utente_tipo IN ('CONSULENTE', 'CLIENTE')),
  prodotto_id INT NOT NULL REFERENCES prodotti(id),
  quantita INT NOT NULL DEFAULT 1 CHECK (quantita >= 0),
  stato VARCHAR(20) DEFAULT 'IN_CANTINA' CHECK (stato IN ('IN_CANTINA', 'CONSUMATA', 'REGALATA')),
  data_aggiunta TIMESTAMP DEFAULT NOW(),
  data_consumo TIMESTAMP,
  nota_degustazione TEXT,
  punteggio_personale SMALLINT CHECK (punteggio_personale BETWEEN 1 AND 5),
  occasione VARCHAR(255),
  in_wishlist BOOLEAN DEFAULT FALSE,
  UNIQUE(utente_id, utente_tipo, prodotto_id, data_aggiunta)
);

-- Magazzino operativo consulente
CREATE TABLE magazzino_consulente (
  id SERIAL PRIMARY KEY,
  consulente_id INT NOT NULL REFERENCES consulenti(id),
  prodotto_id INT NOT NULL REFERENCES prodotti(id),
  quantita_disponibile INT NOT NULL DEFAULT 0 CHECK (quantita_disponibile >= 0),
  quantita_riservata INT NOT NULL DEFAULT 0 CHECK (quantita_riservata >= 0),
  scorta_minima INT NOT NULL DEFAULT 2 CHECK (scorta_minima >= 0),
  data_ultimo_carico DATE,
  data_ultima_uscita DATE,
  UNIQUE(consulente_id, prodotto_id),
  CONSTRAINT chk_riservata CHECK (quantita_riservata <= quantita_disponibile)
);

-- Movimenti magazzino (log immutabile di ogni entrata/uscita)
CREATE TABLE movimenti_magazzino (
  id SERIAL PRIMARY KEY,
  magazzino_id INT NOT NULL REFERENCES magazzino_consulente(id),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN (
    'CARICO', 'VENDITA', 'DEGUSTAZIONE', 'OMAGGIO', 
    'RESO', 'ROTTURA', 'AUTOCONSUMO'
  )),
  quantita INT NOT NULL, -- positivo=entrata, negativo=uscita
  data TIMESTAMP DEFAULT NOW(),
  riferimento_tipo VARCHAR(20) CHECK (riferimento_tipo IN ('ORDINE', 'EVENTO', NULL)),
  riferimento_id INT,
  origine VARCHAR(30) CHECK (origine IN (
    'ACQUISTO_PERSONALE', 'CAMPIONE_GRATUITO', 'OMAGGIO_PROMO', 'STARTER_KIT'
  )),
  note TEXT
);

-- Box degustazione (kit pre-composti per serate)
CREATE TABLE box_degustazione (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,            -- es. "Starter Pack Toscana"
  descrizione TEXT,
  prezzo_pubblico DECIMAL(8,2) NOT NULL,
  prezzo_consulente DECIMAL(8,2) NOT NULL,
  pv_valore INT NOT NULL DEFAULT 0,
  attivo BOOLEAN DEFAULT TRUE
);

CREATE TABLE box_degustazione_righe (
  id SERIAL PRIMARY KEY,
  box_id INT NOT NULL REFERENCES box_degustazione(id),
  prodotto_id INT NOT NULL REFERENCES prodotti(id),
  quantita INT NOT NULL DEFAULT 1 CHECK (quantita > 0)
);

CREATE INDEX idx_mag_consulente ON magazzino_consulente(consulente_id);
CREATE INDEX idx_mov_magazzino ON movimenti_magazzino(magazzino_id, data);
CREATE INDEX idx_cantina_utente ON cantina_personale(utente_id, utente_tipo);
CREATE INDEX idx_mag_alert ON magazzino_consulente(consulente_id) 
  WHERE quantita_disponibile <= scorta_minima; -- indice parziale per query alert
```
