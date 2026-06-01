const Database = require('better-sqlite3');
const crypto = require('crypto');

const dbGioco = new Database('gioco.db');
const dbUser = new Database('user.db'); 

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

dbGioco.exec(`
    CREATE TABLE IF NOT EXISTS parole_usate (
        parola TEXT PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS temi_usati (
        tema TEXT PRIMARY KEY
    );
`);

dbUser.exec(`
    CREATE TABLE IF NOT EXISTS utenti_anonimi (
        id_utente TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        streak INTEGER DEFAULT 0,
        max_streak INTEGER DEFAULT 0,
        ultima_ora_vinta TEXT DEFAULT '',
        totale_risolti INTEGER DEFAULT 0,
        totale_tentativi INTEGER DEFAULT 0
    );
`);

module.exports = {
    checkDuplicates: (words, tema) => {
        const placeholders = words.map(() => '?').join(',');
        const paroleMinuscole = words.map(w => w.toLowerCase().trim());
        const paroleDuplicate = dbGioco.prepare(`SELECT parola FROM parole_usate WHERE parola IN (${placeholders})`).all(...paroleMinuscole);
        const temaDuplicato = dbGioco.prepare(`SELECT tema FROM temi_usati WHERE tema = ?`).get(tema.toLowerCase().trim());
        return { paroleOk: paroleDuplicate.length === 0, temaOk: !temaDuplicato };
    },

    saveAll: (words, tema) => {
        const insertParola = dbGioco.prepare("INSERT OR IGNORE INTO parole_usate (parola) VALUES (?)");
        const insertTema = dbGioco.prepare("INSERT OR IGNORE INTO temi_usati (tema) VALUES (?)");
        const transaction = dbGioco.transaction((wordsArray, temaString) => {
            for (const w of wordsArray) insertParola.run(w.toLowerCase().trim());
            insertTema.run(temaString.toLowerCase().trim());
        });
        transaction(words, tema);
    },

    getAllForPrompt: () => {
        const parole = dbGioco.prepare("SELECT parola FROM parole_usate").all().map(r => r.parola);
        const temi = dbGioco.prepare("SELECT tema FROM temi_usati").all().map(r => r.tema);
        return { parole, temi };
    },

    registraUtente: (id, password) => {
        const idPulito = id.toLowerCase().trim();
        const hash = hashPassword(password);
        try {
            dbUser.prepare(`
                INSERT INTO utenti_anonimi (id_utente, password_hash, streak, max_streak, ultima_ora_vinta, totale_risolti, totale_tentativi) 
                VALUES (?, ?, 0, 0, '', 0, 0)
            `).run(idPulito, hash);
            return { id_utente: idPulito, streak: 0, max_streak: 0, ultima_ora_vinta: '', totale_risolti: 0, totale_tentativi: 0 };
        } catch (e) {
            return { error: "ID già esistente" };
        }
    },

    autenticaEPrendiUtente: (id, password) => {
        const idPulito = id.toLowerCase().trim();
        const hash = hashPassword(password);
        
        const utente = dbUser.prepare("SELECT * FROM utenti_anonimi WHERE id_utente = ?").get(idPulito);
        if (!utente) return { error: "Utente non trovato" };
        if (utente.password_hash !== hash) return { error: "Password errata" };
        
        return {
            id_utente: utente.id_utente,
            streak: utente.streak,
            max_streak: utente.max_streak,
            ultima_ora_vinta: utente.ultima_ora_vinta,
            totale_risolti: utente.totale_risolti,
            totale_tentativi: utente.totale_tentativi
        };
    },

    salvaDatiServer: (id, password, stats) => {
        const idPulito = id.toLowerCase().trim();
        const hash = hashPassword(password);
        
        const check = dbUser.prepare("SELECT password_hash FROM utenti_anonimi WHERE id_utente = ?").get(idPulito);
        if (!check || check.password_hash !== hash) return { error: "Non autorizzato" };

        dbUser.prepare(`
            UPDATE utenti_anonimi 
            SET streak = ?, max_streak = ?, ultima_ora_vinta = ?, totale_risolti = ?, totale_tentativi = ? 
            WHERE id_utente = ?
        `).run(stats.streak, stats.maxStreak, stats.ultimaOraVinta, stats.totaleRisolti, stats.totaleTentativi, idPulito);
        
        return { success: true };
    },

    aggiornaPasswordServer: (id, vecchiaPassword, nuovaPassword) => {
        const idPulito = id.toLowerCase().trim();
        const vecchioHash = hashPassword(vecchiaPassword);
        const nuovoHash = hashPassword(nuovaPassword);
        
        const check = dbUser.prepare("SELECT password_hash FROM utenti_anonimi WHERE id_utente = ?").get(idPulito);
        if (!check || check.password_hash !== vecchioHash) return { error: "Password attuale non valida" };

        dbUser.prepare("UPDATE utenti_anonimi SET password_hash = ? WHERE id_utente = ?").run(nuovoHash, idPulito);
        return { success: true };
    }
};