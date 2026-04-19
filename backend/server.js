const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Inizializza il database SQLite
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath, { verbose: console.log });

// Inizializza la tabella se non esiste
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

console.log('Database SQLite inizializzato con successo.');


/**
 * PROXY PER FURPANEL (Bypass CORS & Forbidden Headers)
 */

const BASE_URL = "https://fzbe.furizon.net/api/v1/";

async function fzGet(url, reqHeaders) {
    try {
        const headers = {
            ...reqHeaders,
            'Referer': "http://furpanel.furizon.net/",
            'Origin': "https://furpanel.furizon.net",
        };
        delete headers.host;
        delete headers['accept-encoding'];
        delete headers['content-length'];
        delete headers['connection'];

        console.log("GET " + BASE_URL + url + "\n" + JSON.stringify(headers));

        const response = await fetch(BASE_URL + url, {
            method: 'GET',
            headers
        });

        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        console.log("HTTP/1.0 " + response.status + "\n" + JSON.stringify(Object.fromEntries(response.headers.entries())) + "\n" + JSON.stringify(data));
        return {data, headers: response.headers, status: response.status};
    } catch (error) {
        console.error('--- Proxy Critical Error ---');
        console.error(error);
        return undefined;
    }
}

async function fzPost(url, bodyObj, reqHeaders) {
    try {
        const headers = {
            ...reqHeaders,
            'Referer': "http://furpanel.furizon.net/",
            'Origin': "https://furpanel.furizon.net",
        };
        delete headers.host;
        delete headers['accept-encoding'];
        delete headers['content-length'];
        delete headers['connection'];
        delete headers['content-type'];
        headers["content-type"] = "application/json";

        let bodyStr = JSON.stringify(bodyObj);

        console.log("POST " + BASE_URL + url + "\n" + JSON.stringify(headers) + "\n" + bodyStr);
        const response = await fetch(BASE_URL + url, {
            method: 'POST',
            headers,
            body: bodyStr
        });

        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        console.log("HTTP/1.0 " + response.status + "\n" + JSON.stringify(Object.fromEntries(response.headers.entries())) + "\n" + JSON.stringify(data));
        return {data: data, headers: response.headers, status: response.status};
    } catch (error) {
        console.error('--- Proxy Critical Error ---');
        console.error(error);
        return undefined;
    }
}

async function fzProxyResponse(fzResponse, res) {
    res.status(fzResponse.status);
    fzResponse.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (!['content-encoding', 'transfer-encoding', 'content-length', 'access-control-allow-origin', 'content-type'].includes(lowerKey)) {
            res.setHeader(key, value);
        }
    });
    res.send(fzResponse.data);
}

async function checkUserPermission(headers) {
    const res = await fzGet("users/display/me", headers)
    if (res == null || res.data?.permissions == undefined) {
        return false;
    }
    return res.data?.permissions.includes("CAN_PERFORM_CHECKINS");
}

async function checkUserPermissionAndSetResponse(headers, res) {
    const hasPermission = await checkUserPermission(headers);
    if (!hasPermission) {
        res.status(400).json({ success: false, message: 'Invalid permission'});
    }
    return hasPermission;
}

function setEmptyResponse(res) {
    res.status(500).json({ success: false, message: 'Empty response from fzbackend' });
}




// ==========================================
// ROTTE DEL SERVER
// ==========================================

/**
 * 1. Recupera i check-in con gadget non ancora consegnati (gadgetCollectedAt IS NULL), ordinati dal più vecchio al più nuovo.
 */
app.get('/api/checkins/pending-gadgets', async (req, res) => {
    try {
        if (!await checkUserPermissionAndSetResponse(req.headers, res)) {
            return;
        }
        const stmt = db.prepare(`
            SELECT * FROM checkins 
            WHERE gadgetCollectedAt IS NULL 
            ORDER BY createdAt ASC
        `);
        const pendingCheckins = stmt.all();
        res.json({ success: true, data: pendingCheckins });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Errore nel recupero dei dati.' });
    }
});

/**
 * 2. Segna un ordine gadget come "servito" impostando gadgetCollectedAt = datetime('now')
 */
app.put('/api/checkins/:id/serve-gadget', async (req, res) => {
    try {
        // MEMO: questo fa il controllo per vedere se l'utente ha i permessi
        if (!await checkUserPermissionAndSetResponse(req.headers, res)) {
            return;
        }
        const { id } = req.params;
        const stmt = db.prepare(`
            UPDATE checkins 
            SET gadgetCollectedAt = datetime('now') 
            WHERE id = ?
        `);
        const result = stmt.run(id);
        
        if (result.changes > 0) {
            res.json({ success: true, message: 'Gadget segnato come consegnato.' });
        } else {
            res.status(404).json({ success: false, message: 'Check-in non trovato.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Errore durante l'aggiornamento." });
    }
});

/**
 * Endpoint extra per inserire un check-in di test
 */
app.post('/api/checkins', (req, res) => {
    try {
        //TODO prendere dati da backend e restituirli indietro al front
        const {
            checkinId, checkinNonce, checkinListId, 
            fursonaName, firstName, lastName, 
            orderSerial, orderCode, gadgets, 
            shirtSize, portaBadgeType, lanyardType, 
            hasFursuitBadge, shouldPrintApsJoinModule
        } = req.body;

        const stmt = db.prepare(`
            INSERT INTO checkins (
                checkinId, checkinNonce, checkinListId, 
                fursonaName, firstName, lastName, 
                orderSerial, orderCode, gadgets, 
                shirtSize, portaBadgeType, lanyardType, 
                hasFursuitBadge, shouldPrintApsJoinModule
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            checkinId, checkinNonce, checkinListId, 
            fursonaName, firstName, lastName, 
            orderSerial, orderCode, JSON.stringify(gadgets), 
            shirtSize, portaBadgeType, lanyardType, 
            hasFursuitBadge, shouldPrintApsJoinModule
        );
        
        res.json({ success: true, insertedId: result.lastInsertRowid });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Errore durante l\'inserimento.' });
    }
});

app.get('/api/proxy/checkin/lists', async (req, res) => {
    const fzRes = fzGet("checkin/lists", headers);
    fzProxyResponse(fzRes, res);
});

//app.get('/api/proxy/checkin/search', async (req, res) => {
//    const fzRes = fzGet("checkin/lists", headers);
//    fzProxyResponse(fzRes, res);
//});

app.get('/api/proxy/authentication/me', async (req, res) => {
    const fzRes = fzGet("users/display/me", headers);
    fzProxyResponse(fzRes, res);
});

app.post('/api/proxy/authentication/login', async (req, res) => {
    let { headers } = req;
    const fzRes = await fzPost("authentication/login", {
        "email": req.body.email,
        "password": req.body.password
    }, headers)
    if (fzRes == undefined) {
        setEmptyResponse(res);
        return;
    }
    if (fzRes.data?.accessToken == undefined) {
        fzProxyResponse(fzRes, res);
        return;
    }
    let token = fzRes.data?.accessToken;
    headers["authorization"] = "Bearer " + token;
    if (!await checkUserPermissionAndSetResponse(headers, res)) {
        return;
    }
    res.status(200).json({token: token});
});

app.listen(port, () => {
    console.log(`Server in ascolto su http://localhost:${port}`);
});
