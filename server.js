require('dotenv').config(); 
const { Groq } = require("groq-sdk"); 
const db = require("./database"); 
const fs = require('fs'); 
const express = require('express'); 
const path = require('path'); 

const app = express(); 
const PORT = 3000; 

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY }); 
const MODELLO = "openai/gpt-oss-120b";  

function generaPromptSistema(difficolta) {
    const base = `Sei un game designer di giochi di parole in italiano. Generi sfide con 4 parole legate a un tema. 

REGOLE: 
- 4 parole STRETTAMENTE legate al tema, sostantivi comuni 
- Lunghezze TUTTE DIVERSE tra loro (es. 4,5,7,8 — mai due uguali) 
- Ogni parola: minimo 4, maximum 9 lettere 
- Solo parole del vocabolario base italiano (livello scuola elementare) 
- NO parole tecniche, arcaiche, letterarie o regionali 
- NO parola contenuta in un'altra (es. "mare"+"maremma" vietato)`;

    const istruzioni = {
        facile: `
DIFFICOLTA: FACILE
- Parole molto comuni e brevi (4-6 lettere)
- Temi familiari e semplici (animali, colori, cibo, corpo, casa, famiglia)
ESEMPI VALIDI (facile):
{"tema":"animali","parole":["cane","gatto","topo","orso"]}
{"tema":"colori","parole":["rosa","giallo","verde","blu"]}`,
        medio: `
DIFFICOLTA: MEDIA
- Parole di media difficoltà (4-8 lettere)
- Temi vari e moderatamente specifici
ESEMPI VALIDI (media):
{"tema":"cucina","parole":["sale","forno","tegame","mestolo"]}
{"tema":"scuola","parole":["riga","banco","quaderno","lavagna"]}`,
        difficile: `
DIFFICOLTA: DIFFICILE
- Parole più lunghe e meno comuni (5-9 lettere)
- Temi più specifici e variegati
ESEMPI VALIDI (difficile):
{"tema":"astronomia","parole":["sole","luna","pianeta","galassia"]}
{"tema":"geografia","parole":["fiume","lago","montagna","isola"]}`
    };

    return base + (istruzioni[difficolta] || istruzioni.medio) + `

Rispondi SOLO con JSON valido, nessun testo prima o dopo.`;
} 

function pulisci(str) { 
    if (!str) return ""; 
    return str 
        .normalize("NFD") 
        .replace(/[\u0300-\u036f]/g, "")  
        .toUpperCase() 
        .replace(/[^A-Z]/g, '')         
        .trim(); 
} 

function estraiJson(testo) { 
    if (!testo) throw new Error("Testo vuoto"); 
    
	let pulito = testo.replace(/```(?:json)?\s*/g, "").trim();
    try { 
        return JSON.parse(pulito); 
    } catch (e) {} 
 
    const match = pulito.match(/\{[\s\S]*?\}/); 
    if (match) { 
        try { 
            return JSON.parse(match[0]); 
        } catch (e) {} 
    } 
    
    throw new Error(`Nessun JSON valido trovato nella stringa.`); 
} 

async function generaSingolaSfida(evita, difficolta = 'medio') { 
    const temiRecenti = evita.temi ? evita.temi.slice(-15).join(', ') : "nessuno"; 
    const paroleRecenti = evita.parole ? evita.parole.slice(-30).join(', ') : "nessuna"; 

    const prompt = `Temi già usati (evita): [${temiRecenti}] 
Parole già usate (evita): [${paroleRecenti}] 

Rispondi SOLO con JSON: {"tema":"...","parole":["...","...","...","..."]}`; 

    const systemPrompt = generaPromptSistema(difficolta);

    const completion = await groq.chat.completions.create({ 
        messages: [ 
            { role: "system", content: systemPrompt }, 
            { role: "user", content: prompt } 
        ], 
        model: MODELLO, 
        temperature: 1, 
        max_completion_tokens: 4000,  
        top_p: 1, 
        reasoning_effort: "high"      
    }); 

    const choice = completion.choices[0]; 
    const content = choice.message.content || ""; 
    const reasoning = choice.message.reasoning || ""; 

    if (content.trim()) return estraiJson(content); 

    if (reasoning) { 
        const matches = reasoning.match(/\{[\s\S]*?\}/g); 
        if (matches) { 
            return estraiJson(matches[matches.length - 1]); 
        } 
    } 

    throw new Error(`Risposta vuota dall'AI.`); 
} 

async function pianificaSfidaPerOra(targetHour, difficolta = 'medio') {
    let valida = false; 
    let tentativi = 0; 
    
    console.log(`[AI] Avvio generazione [${difficolta}] per l'ora target: ${String(targetHour).padStart(2, '0')}:00`);

    while (!valida) { 
        tentativi++; 
        try { 
            const evita = db.getAllForPrompt();  
            const data = await generaSingolaSfida(evita, difficolta); 

            const temaRaw = data.tema || ""; 
            const paroleRaw = data.parole || []; 

            const parolePulite = paroleRaw.map(p => pulisci(p)); 
            const lunghezze = parolePulite.map(p => p.length); 
            
            const lunghezzeUniche = new Set(lunghezze).size === 4; 
            const tutteLunghezzaOk = parolePulite.every(l => l.length >= 4 && l.length <= 9); 
            const { paroleOk, temaOk } = db.checkDuplicates(parolePulite, temaRaw); 
            
            let nessunaSottoparola = true; 
            for (let idx = 0; idx < parolePulite.length; idx++) { 
                for (let j = idx + 1; j < parolePulite.length; j++) { 
                    if (parolePulite[idx].includes(parolePulite[j]) || parolePulite[j].includes(parolePulite[idx])) { 
                        nessunaSottoparola = false; 
                    } 
                } 
            } 

            if (lunghezzeUniche && tutteLunghezzaOk && paroleOk && temaOk && nessunaSottoparola) { 
                let lettereArray = parolePulite.join('').split(''); 
                lettereArray.sort(() => Math.random() - 0.5); 

                const nuovaSfida = { 
                    ora: targetHour, 
                    difficolta: difficolta,
                    tema: temaRaw.toUpperCase(), 
                    parole_soluzione: parolePulite.map(p => p.toLowerCase()), 
                    lettere: lettereArray 
                }; 
                aggiornaCacheSfida(nuovaSfida);

                console.log(`[OK] Generata sfida [${difficolta}] per le ore ${String(targetHour).padStart(2, '0')}:00 | ${temaRaw.toUpperCase()} → [${parolePulite.join(', ')}]`); 
                valida = true; 
            } else { 
                let motivi = []; 
                if (!lunghezzeUniche) motivi.push("lunghezze duplicate"); 
                if (!tutteLunghezzaOk) motivi.push("lunghezza fuori range (4-9)"); 
                if (!paroleOk || !temaOk) motivi.push("duplicati nel database"); 
                if (!nessunaSottoparola) motivi.push("sottoparola rilevata"); 
                
                console.log(`[RETRY] [${difficolta}] Tentativo ${tentativi} fallito: ${motivi.join(', ')}. Riprovo tra 15s...`); 
                await new Promise(r => setTimeout(r, 15000)); 
            } 
        } catch (e) { 
            console.log("[ERROR AI] " + e.message); 
            const attesa = (e.message.includes("429") || e.message.includes("rate_limit")) ? 60000 : 10000;
            await new Promise(r => setTimeout(r, attesa)); 
        } 
    } 
}

function aggiornaCacheSfida(sfida) {
    let dati = [];
    if (fs.existsSync('giornata_completa.json')) {
        try { dati = JSON.parse(fs.readFileSync('giornata_completa.json', 'utf8')); } catch(e) { dati = []; }
    }
    dati = dati.filter(d => !(d.ora === sfida.ora && d.difficolta === sfida.difficolta));
    dati.push(sfida);
    fs.writeFileSync('giornata_completa.json', JSON.stringify(dati, null, 2));
}

async function generaTutteDifficolta(ora) {
    const difficolta = ['facile', 'medio', 'difficile'];
    for (const d of difficolta) {
        await pianificaSfidaPerOra(ora, d);
    }
}

function avviaLoopGenerazione() {
    let oraCorrente = new Date().getHours();
    
    setInterval(async () => {
        let nuovaOra = new Date().getHours();
        if (nuovaOra !== oraCorrente) {
            oraCorrente = nuovaOra;
            let oraSuccessiva = (oraCorrente + 1) % 24;
            console.log(`[SYSTEM] Nuova ora rilevata (${oraCorrente}:00). Avvio generazione preventiva per le ${oraSuccessiva}:00.`);
            await generaTutteDifficolta(oraSuccessiva);
        }
    }, 60000); 
}

async function inizializzaServer() {
    const oraAttuale = new Date().getHours();
    const oraSuccessiva = (oraAttuale + 1) % 24;
    const difficolta = ['facile', 'medio', 'difficile'];
    
    let sfideSalvate = [];
    if (fs.existsSync('giornata_completa.json')) {
        try { 
            sfideSalvate = JSON.parse(fs.readFileSync('giornata_completa.json', 'utf8')); 
            if (sfideSalvate.length > 0) {
                console.log(`[CACHE] ${sfideSalvate.length} sfide trovate in giornata_completa.json:`);
                sfideSalvate.forEach(s => console.log(`  → ore ${String(s.ora).padStart(2,'0')}:00 [${s.difficolta||'?'}] ${s.tema}: ${(s.parole_soluzione||[]).join(', ')}`));
            }
        } catch(e){}
    }

    for (const d of difficolta) {
        if (!sfideSalvate.some(s => s.ora === oraAttuale && s.difficolta === d)) {
            console.log(`[STARTUP] Manca la sfida [${d}] per l'ora corrente (${oraAttuale}:00). Generazione immediata...`);
            await pianificaSfidaPerOra(oraAttuale, d);
        }
        if (!sfideSalvate.some(s => s.ora === oraSuccessiva && s.difficolta === d)) {
            console.log(`[STARTUP] Manca la sfida preventiva [${d}] per l'ora successiva (${oraSuccessiva}:00). Generazione...`);
            await pianificaSfidaPerOra(oraSuccessiva, d);
        }
    }

    avviaLoopGenerazione();
}

app.use(express.json()); 
app.use(express.static(path.join(__dirname))); 

const CACHE_DIR = path.join(__dirname, 'cache-immagini');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

app.get('/api/proxy-immagine', async (req, res) => {
    const parola = req.query.parola || '';
    if (!parola) return res.status(400).json({ error: "Parametro 'parola' mancante" });

    const key = parola.toLowerCase();
    const cacheJpg = path.join(CACHE_DIR, key + '.jpg');
    const cacheMeta = path.join(CACHE_DIR, key + '.json');

    if (fs.existsSync(cacheJpg) && fs.existsSync(cacheMeta)) {
        const buf = fs.readFileSync(cacheJpg);
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=604800');
        return res.send(buf);
    }

    const PEXELS_KEY = process.env.PEXELS_API_KEY;
    if (!PEXELS_KEY) {
        return res.status(500).json({ error: "PEXELS_API_KEY non configurata" });
    }

    try {
        const searchRes = await fetch(
            `https://api.pexels.com/v1/search?query=${encodeURIComponent(key)}&per_page=3&orientation=square`,
            { headers: { Authorization: PEXELS_KEY }, signal: AbortSignal.timeout(15000) }
        );
        if (!searchRes.ok) {
            let detail = '';
            try { const j = await searchRes.json(); detail = JSON.stringify(j).substring(0, 200); } catch {}
            throw new Error(`Pexels search ${searchRes.status} ${detail}`);
        }

        const data = await searchRes.json();
        if (!data.photos || data.photos.length === 0) {
            throw new Error('Nessuna foto trovata per ' + key);
        }

        let lastErr = null;
        for (let i = 0; i < Math.min(data.photos.length, 5); i++) {
            const photo = data.photos[i];
            const imgUrl = photo.src.small;
            try {
                const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(30000) });
                if (!imgRes.ok) throw new Error(`status ${imgRes.status}`);
                const buffer = Buffer.from(await imgRes.arrayBuffer());
                fs.writeFile(cacheJpg, buffer, () => {});
                fs.writeFile(cacheMeta, JSON.stringify({
                    photographer: photo.photographer,
                    pexelsUrl: photo.url,
                    imgUrl: imgUrl,
                }), () => {});
                res.set('Content-Type', 'image/jpeg');
                res.set('Cache-Control', 'public, max-age=604800');
                return res.send(buffer);
            } catch (e) {
                lastErr = e;
                console.log(`[IMG RETRY ${i+1}] ${key}: fallita foto ${i+1} (${e.message})`);
            }
        }

        throw new Error(`Tutti i ${Math.min(data.photos.length, 5)} tentativi falliti. Ultimo: ${lastErr?.message}`);
    } catch (e) {
        console.log(`[IMG ERR] ${key}: ${e.message}`);
        res.status(502).json({ error: e.message });
    }
});

app.get('/api/sfida-corrente', (req, res) => {
    const oraAttuale = new Date().getHours();
    const difficolta = req.query.difficolta || 'medio';
    if (!fs.existsSync('giornata_completa.json')) {
        return res.status(404).json({ error: "Nessuna sfida pronta. Riprova tra un momento." });
    }
    
    const sfide = JSON.parse(fs.readFileSync('giornata_completa.json', 'utf8'));
    const sfidaDiAdesso = sfide.find(s => s.ora === oraAttuale && s.difficolta === difficolta);
    
    if (!sfidaDiAdesso) {
        return res.status(404).json({ error: `Sfida [${difficolta}] per quest'ora non ancora generata.` });
    }
    console.log(`[API] Richiesta sfida [${difficolta}] ore ${String(oraAttuale).padStart(2,'0')}:00 → tema: ${sfidaDiAdesso.tema}, parole: [${sfidaDiAdesso.parole_soluzione.join(', ')}]`);
    res.json(sfidaDiAdesso);
});

app.post('/api/register', (req, res) => { 
    const { id, password } = req.body; 
    if (!id || !password) return res.status(400).json({ error: "Dati incompleti" }); 

    const risultato = db.registraUtente(id, password); 
    if (risultato.error) return res.status(400).json({ error: risultato.error }); 
    res.json(risultato); 
}); 

app.post('/api/login', (req, res) => { 
    const { id, password } = req.body; 
    if (!id || !password) return res.status(400).json({ error: "Dati incompleti" }); 

    const risultato = db.autenticaEPrendiUtente(id, password); 
    if (risultato.error) return res.status(401).json({ error: risultato.error }); 
    res.json(risultato); 
}); 

app.post('/api/sync', (req, res) => { 
    const { id, password, stats } = req.body; 
    if (!id || !password || !stats) return res.status(400).json({ error: "Dati incompleti" }); 

    const risultato = db.salvaDatiServer(id, password, stats); 
    if (risultato.error) return res.status(403).json({ error: risultato.error }); 
    res.json(risultato); 
}); 

app.post('/api/change-password', (req, res) => { 
    const { id, vecchiaPassword, nuovaPassword } = req.body; 
    if (!id || !vecchiaPassword || !nuovaPassword) return res.status(400).json({ error: "Dati incompleti" }); 

    const risultato = db.aggiornaPasswordServer(id, vecchiaPassword, nuovaPassword); 
    if (risultato.error) return res.status(403).json({ error: risultato.error }); 
    res.json(risultato); 
}); 

app.listen(PORT, async () => { 
    console.log(` Scompidle Server attivo su: http://localhost:${PORT}`); 

    await inizializzaServer();
});
