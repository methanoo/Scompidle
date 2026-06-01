# Scompidle

> Nato dal desiderio di creare un word puzzle nativamente italiano, visto che giochi come Jumblie sono solo in inglese.

---

## Badges

<!-- ![Status](https://img.shields.io/badge/status-active-success?style=for-the-badge) -->
![Status](https://img.shields.io/badge/status-inactive-red?style=for-the-badge)  
 
![AI](https://img.shields.io/badge/AI-Groq-blueviolet?style=for-the-badge)   
![License](https://img.shields.io/badge/license-private-lightgrey?style=for-the-badge)   
![Game Type](https://img.shields.io/badge/type-word%20puzzle-black?style=for-the-badge)   

![Frontend](https://img.shields.io/badge/frontend-HTML%20%7C%20CSS%20%7C%20JS-orange?style=for-the-badge)   
![Backend](https://img.shields.io/badge/backend-node.js-green?style=for-the-badge)

---

## Preview

![Gameplay Preview](INSERIRE FOTO)

---

## Cos’è Scompidle

Scompidle è un gioco di parole che cambia ogni ora.

Ogni ora ti arriva un nuovo puzzle, sempre diverso:

* tema generato al volo
* parole coerenti col tema
* controllate dall’AI
* zero ripetizioni random a caso

---

## Come si gioca

![Loop](INSERIRE FOTO)

Ogni ora succede questo:

1. viene scelto un tema (tipo: cucina, sport, scuola, ecc.)
2. vengono generate 4 parole collegate tra loro
3. tutte le lettere vengono mischiate in un unico pool
4. tu devi ricostruire le parole

Quando ne indovini una, quelle lettere spariscono dal gioco.

---

## Meccaniche


### Controlli

| Tasto     | Cosa fa         |
| --------- | --------------- |
| A-Z       | scrivi lettere  |
| Backspace | cancella        |
| Spazio    | mescola lettere |
| Enter     | invia parola    |

---

## Stile del gioco

![UI](INSERIRE FOTO)

### Colori

Ogni parola completata viene assegnata a uno stato visivo tramite colore.
I colori non sono casuali: dipendono dalla lunghezza della parola.

* 🔴 Rosso → parola più corta (minimo 4 lettere)
* 🟠 Arancione → leggermente più lunga
* 🟢 Verde → parole medio-lunghe
* 🔵 Blu → parola più lunga (fino a 9 lettere)

Le 4 parole di ogni puzzle hanno lunghezze tutte diverse, quindi ogni colore rappresenta un livello diverso di complessità.


---

## Account

![Auth](INSERIRE FOTO)

Ogni utente ha:

* un ID generato tipo animale-aggettivo-numero
* password salvata hashata
* possibilità di sync tra dispositivi

Esempio:


lince-glaciale-481


---

## Sicurezza (base ma seria)

* password hashate (SHA-256)
* sessioni server-side
* controlli backend sempre attivi

---

## Statistiche

![Stats](INSERIRE FOTO)

Tiene traccia di:

* ore completate
* streak attuale
* miglior streak
* tentativi medi per puzzle


---

## AI Engine

![AI](INSERIRE FOTO)

Usa Groq per generare i puzzle.

### Come funziona

* genera il puzzle un’ora prima
* controlla che sia valido
* se fallisce, ritenta da solo
* non blocca mai il gioco

---

### Regole dei puzzle

* niente parole duplicate
* parole tra 4 e 9 lettere
* niente ripetizioni recenti
* tema sempre coerente

---

## Architettura

┌──────────────────────┐    ┌──────────────┐    ┌──────────────────────────┐    ┌────────────────────┐
│ Frontend (JS puro)   │ →  │ Express API  │ →  │ SQLite DB (2 database)   │ →  │ AI Engine (Groq)   │
└──────────────────────┘    └──────────────┘    └──────────────────────────┘    └────────────────────┘

---

## Database

### game.db

* storico temi
* parole usate
* anti-ripetizione

### user.db

* utenti
* password hashate
* statistiche e streak

---

## Sistema del tempo

Formato:


YYYY-M-D-HH


Serve per:

* garantire puzzle diversi ogni ora
* sincronizzazione globale
* evitare duplicati

---

## Stabilità

* se l’AI si rompe, il gioco continua comunque
* retry automatici
* recovery all’avvio
* fallback sempre attivo
* backend separati per auth e game

---

## Conclusione

Scompidle è nato un po’ per gioco. 
L’idea era semplice, ma metterla in piedi non lo è mai davvero.

Non è un progetto perfetto, né qualcosa di finito: cambia e ogni tanto si rompe pure, come succede quando provi a costruire qualcosa da zero senza una guida precisa.

Il giudizio finale lo lasciamo a chi ci gioca. Noi abbiamo fatto la nostra parte, adesso tocca a voi giocarci.

---