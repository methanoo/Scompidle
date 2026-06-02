# Scompidle

> Nato dal desiderio di creare un word puzzle nativamente italiano, visto che giochi come Jumblie sono solo in inglese.

---

## Badges

![Status](https://img.shields.io/badge/status-active-success?style=for-the-badge)
![AI](https://img.shields.io/badge/AI-Groq-blueviolet?style=for-the-badge)
![Game Type](https://img.shields.io/badge/type-word%20puzzle-black?style=for-the-badge)
![Frontend](https://img.shields.io/badge/frontend-HTML%20%7C%20CSS%20%7C%20JS-orange?style=for-the-badge)
![Backend](https://img.shields.io/badge/backend-node.js-green?style=for-the-badge)
![Database](https://img.shields.io/badge/database-SQLite-blue?style=for-the-badge)

---

## Cos'è Scompidle

Scompidle è un gioco di parole che cambia ogni ora. Ogni ora ricevi un nuovo puzzle con 4 parole da scoprire, legate a un tema generato dall'AI.

![Logo](https://tiny-grass-2b73.sonounutentegoogl.workers.dev/)

---

## Come si gioca

1. Viene scelto un tema (cucina, sport, scuola, ecc.)
2. Vengono generate 4 parole collegate tra loro (lunghezze tutte diverse)
3. Tutte le lettere vengono mischiate in un unico pool
4. Ricostruisci le parole cliccando le lettere o usando la tastiera
5. Quando indovini una parola, le lettere spariscono e compare un'immagine correlata

### Controlli

| Tasto     | Azione            |
| --------- | ----------------- |
| A-Z       | Scrivi lettere    |
| Backspace | Cancella ultima   |
| Spazio    | Mescola lettere   |
| Enter     | Invia parola      |

---

## Funzionalità

### 3 Livelli di Difficoltà

- **Facile** — Parole comuni e brevi (4-6 lettere), temi familiari
- **Medio** — Difficoltà bilanciata (4-8 lettere), temi vari
- **Difficile** — Parole più lunghe (5-9 lettere), temi specifici

Ogni livello ha progresso e salvataggio indipendente.

### Generazione AI (Groq)

Usa il modello `openai/gpt-oss-120b` di Groq per generare i puzzle. Il sistema:
- genera il puzzle un'ora prima
- valida che non ci siano duplicati, sottoparole o lunghezze uguali
- se fallisce, riprova automaticamente
- tiene traccia di temi e parole già usati per evitare ripetizioni

### Sistema di Autenticazione

- ID utente generato automaticamente (formato: animale-aggettivo-numero, es. `lince-glaciale-481`)
- Password hashata con SHA-256
- Sincronizzazione progressi tra dispositivi
- Possibilità di cambiare password dal profilo

![Logo](https://square-art-443c.sonounutentegoogl.workers.dev/)

### Statistiche

- Ore completate
- Streak attuale e miglior streak
- Tentativi medi per puzzle

![Logo](https://summer-art-40af.sonounutentegoogl.workers.dev/)

### Immagini (Pexels)

Alla scoperta di ogni parola, viene caricata un'immagine correlata tramite API Pexels, con caching locale per evitare chiamate ripetute.

### Temi (Dark/Light)

Supporto di temi chiaro e scuro con preferenza salvata in localStorage e rispetto della preferenza di sistema.

### Animazione di Vittoria

Canvas animation con particelle e loader stile "party" al completamento di una sfida.

![Logo](https://wild-glitter-3921.sonounutentegoogl.workers.dev/)

### Salvataggio Progresso

Il gioco salva automaticamente il progresso per ogni ora e difficoltà, permettendo di riprendere da dove si era lasciato.

### Altro

- Logo animato con lettere che si mischiano all'hover
- Background ondulato animato (SVG + CSS)
- Countdown per la prossima sfida
- Notifiche toast
- Pulisce automaticamente i salvataggi delle ore precedenti

---

## Architettura

```
┌──────────────────────┐    ┌──────────────┐    ┌──────────────────────────┐    ┌────────────────────┐
│ Frontend (JS puro)   │ →  │ Express API  │ →  │ SQLite DB (gioco + user) │ →  │ AI Engine (Groq)   │
└──────────────────────┘    └──────────────┘    └──────────────────────────┘    └────────────────────┘
                                    ↓
                           ┌──────────────────┐
                           │ Pexels API       │
                           │ (immagini)       │
                           └──────────────────┘
```

## Database

### gioco.db
- Storico temi usati
- Storico parole usate
- Sistema anti-ripetizione

### user.db
- Utenti con ID anonimi
- Password hashate (SHA-256)
- Statistiche e streak

## API Endpoints

| Metodo | Endpoint             | Descrizione                    |
| ------ | --------------------  | ------------------------------ |
| GET    | `/api/sfida-corrente` | Recupera la sfida dell'ora     |
| POST   | `/api/register`       | Registra nuovo utente          |
| POST   | `/api/login`          | Autentica utente               |
| POST   | `/api/sync`           | Sincronizza statistiche        |
| POST   | `/api/change-password` | Cambia password               |
| GET    | `/api/proxy-immagine`  | Proxy immagini Pexels (cached) |

## Tecnologie

- **Frontend**: HTML, CSS (variabili CSS, animazioni), JavaScript vanilla
- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **AI**: Groq SDK (openai/gpt-oss-120b)
- **API Terze**: Pexels (immagini stock)

## Setup

1. Clona il repository
2. Installa le dipendenze: `npm install`
3. Crea un file `.env` con le tue chiavi:
   ```
   GROQ_API_KEY=la_tua_chiave_groq
   PEXELS_API_KEY=la_tua_chiave_pexels
   ```
4. Avvia il server: `node server.js`
5. Apri `http://localhost:3000`

## Stabilità

- Se l'AI si rompe, il gioco continua comunque
- Retry automatici con backoff
- Cache su disco delle sfide generate
- Recovery all'avvio: se mancano sfide per l'ora corrente o successiva, vengono generate automaticamente
- Caching delle immagini per ridurre chiamate API

---

## Conclusione

Scompidle è nato un po' per gioco. L'idea era semplice, ma metterla in piedi non lo è mai davvero.

Non è un progetto perfetto, né qualcosa di finito: cambia e ogni tanto si rompe pure, come succede quando provi a costruire qualcosa da zero senza una guida precisa.

Il giudizio finale lo lasciamo a chi ci gioca. Noi abbiamo fatto la nostra parte, adesso tocca a voi giocarci.
