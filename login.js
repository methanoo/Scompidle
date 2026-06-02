const express = require('express');
const path = require('path');
const dbController = require('./database.js'); 

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/api/register', (req, res) => {
    const { id, password } = req.body;
    if (!id || !password) return res.status(400).json({ error: "Dati incompleti" });

    const risultato = dbController.registraUtente(id, password);
    if (risultato.error) return res.status(400).json({ error: risultato.error });
    res.json(risultato);
});

app.post('/api/login', (req, res) => {
    const { id, password } = req.body;
    if (!id || !password) return res.status(400).json({ error: "Dati incompleti" });

    const risultato = dbController.autenticaEPrendiUtente(id, password);
    if (risultato.error) return res.status(401).json({ error: risultato.error });
    res.json(risultato);
});

app.post('/api/sync', (req, res) => {
    const { id, password, stats } = req.body;
    if (!id || !password || !stats) return res.status(400).json({ error: "Dati incompleti" });

    const risultato = dbController.salvaDatiServer(id, password, stats);
    if (risultato.error) return res.status(403).json({ error: risultato.error });
    res.json(risultato);
});

app.post('/api/change-password', (req, res) => {
    const { id, vecchiaPassword, nuovaPassword } = req.body;
    if (!id || !vecchiaPassword || !nuovaPassword) return res.status(400).json({ error: "Dati incompleti" });

    const risultato = dbController.aggiornaPasswordServer(id, vecchiaPassword, nuovaPassword);
    if (risultato.error) return res.status(403).json({ error: risultato.error });
    res.json(risultato);
});

app.listen(PORT, () => {
    console.log(` scompidle Server attivo su: http://localhost:${PORT}`);
    console.log(` separazione DB Pronta (gioco.db + user.db)`);
});