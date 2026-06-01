require('dotenv').config();
const { Groq } = require("groq-sdk");
const db = require("./database");
const fs = require('fs');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODELLO = "openai/gpt-oss-120b"; 
const NUMERO_SFIDE = 2; 

function generaPromptSistema(difficolta) {
    const base = `Sei un game designer di giochi di parole in italiano. Generi sfide con 4 parole legate a un tema.

REGOLE:
- 4 parole STRETTAMENTE legate al tema, sostantivi comuni
- Lunghezze TUTTE DIVERSE tra loro (es. 4,5,7,8 — mai due uguali)
- Ogni parola: minimo 4, massimo 9 lettere
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
    
    let pulito = testo.replace(/```(?:json)?/g, "").trim();
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
    const finish = choice.finish_reason;
    const content = choice.message.content || "";
    
    const reasoning = choice.message.reasoning || "";

    console.log(`  finish_reason: ${finish}`);

    if (content.trim()) {
        return estraiJson(content);
    }

    if (reasoning) {
        const matches = reasoning.match(/\{[\s\S]*?\}/g);
        if (matches) {
            const ultimoJson = matches[matches.length - 1];
            console.log(`  JSON estratto dal reasoning: ${ultimoJson}`);
            return estraiJson(ultimoJson);
        }
    }

    throw new Error(`Risposta vuota dall'AI. finish_reason=${finish}`);
}

async function avvia() {
    const giornata = [];

    for (let i = 0; i < NUMERO_SFIDE; i++) {
        let valida = false;
        let tentativi = 0;
        
        while (!valida) {
            tentativi++;
            try {
                const evita = db.getAllForPrompt(); 
                const data = await generaSingolaSfida(evita);

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

                console.log(`  Tentativo ${tentativi}: ${temaRaw} | [${paroleRaw}] | lunghezze: [${lunghezze}]`);

                if (lunghezzeUniche && tutteLunghezzaOk && paroleOk && temaOk && nessunaSottoparola) {
                    db.saveAll(parolePulite, temaRaw);

                    let lettereArray = parolePulite.join('').split('');
                    lettereArray.sort(() => Math.random() - 0.5);

                    giornata.push({
                        ora: i,
                        difficolta: 'medio',
                        tema: temaRaw.toUpperCase(),
                        parole_soluzione: parolePulite.map(p => p.toLowerCase()),
                        lettere: lettereArray
                    });

                    console.log(`[OK] Ora ${String(i).padStart(2, '0')}:00 | ${temaRaw.toUpperCase()} → [${parolePulite}]`);
                    valida = true;
                } else {
                    let motivi = [];
                    if (!lunghezzeUniche) motivi.push("lunghezze duplicate");
                    if (!tutteLunghezzaOk) motivi.push("lunghezza fuori range (4-9)");
                    if (!paroleOk || !temaOk) motivi.push("duplicati nel database");
                    if (!nessunaSottoparola) motivi.push("sottoparola rilevata");
                    
                    console.log(`[RETRY] Ora ${String(i).padStart(2, '0')}:00 → ${motivi.join(', ')}`);
                }

                await new Promise(r => setTimeout(r, 15000));

            } catch (e) {
                const msg = e.message;
                console.log("[ERROR] " + msg);

                if (msg.includes("rate_limit") || msg.includes("429") || msg.includes("413")) {
                    console.log("  → Rate limit rilevato, attendo 60s prima di riprovare...");
                    await new Promise(r => setTimeout(r, 60000));
                } else {
                    await new Promise(r => setTimeout(r, 10000));
                }
            }
        }
    }
    
    fs.writeFileSync('giornata_completa.json', JSON.stringify(giornata, null, 2));
    console.log(`\n✓ Completato: ${giornata.length} sfide salvate in giornata_completa.json`);
}

avvia();