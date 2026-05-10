const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
    next();
});

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath, { verbose: console.log });
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

try {
    const tableInfo = db.prepare("PRAGMA table_info(checkins)").all();
    if (!tableInfo.some(col => col.name === 'propicUrl')) {
        console.log('Migrazione: aggiunta colonna propicUrl...');
        db.prepare("ALTER TABLE checkins ADD COLUMN propicUrl TEXT NULL").run();
    }
} catch (e) {
    console.error("Migration error:", e.message);
}

const BASE_URL = "https://fzbe.furizon.net/api/v1/";

async function fzGet(url, reqHeaders) {
    const headers = {
        'Authorization': reqHeaders['authorization'],
        'x-operator-id': reqHeaders['x-operator-id'],
        'Referer': "http://furpanel.furizon.net/",
        'Origin': "https://furpanel.furizon.net"
    };
    const response = await fetch(BASE_URL + url, { method: 'GET', headers });
    const data = await response.json().catch(() => response.text());
    return {data, headers: response.headers, status: response.status};
}

async function fzPost(url, bodyObj, reqHeaders) {
    const headers = {
        'Authorization': reqHeaders['authorization'],
        'x-operator-id': reqHeaders['x-operator-id'],
        'Content-Type': 'application/json',
        'Referer': "http://furpanel.furizon.net/",
        'Origin': "https://furpanel.furizon.net"
    };
    const response = await fetch(BASE_URL + url, { 
        method: 'POST', 
        headers, 
        body: JSON.stringify(bodyObj) 
    });
    const data = await response.json().catch(() => response.text());
    return {data, headers: response.headers, status: response.status};
}

async function checkUserPermission(headers) {
    const res = await fzGet("users/display/me", headers);
    return res?.data?.permissions?.includes("CAN_PERFORM_CHECKINS") || false;
}

const checkAuth = async (req, res, next) => {
    if (await checkUserPermission(req.headers)) return next();
    res.status(401).json({ errors: [{ message: 'Unauthorized', code: 'UNAUTHORIZED' }] });
};

const api = express.Router();

api.get('/test', (req, res) => res.send('OK - Server is working'));

api.get('/checkin/pending-gadgets', checkAuth, (req, res) => {
    console.log('[GET] pending-gadgets called');
    const data = db.prepare('SELECT * FROM checkins ORDER BY createdAt ASC').all();
    res.json({ success: true, data });
});

api.get('/checkin/updates', checkAuth, (req, res) => {
    const lastId = Number(req.query.lastId);
    if (isNaN(lastId)) return res.status(400).json({ success: false, message: 'valid lastId is required' });
    
    console.log(`[POLL] Checking updates after ID: ${lastId}`);
    const data = db.prepare('SELECT * FROM checkins WHERE id > ? ORDER BY id ASC').all(lastId);
    console.log(`[POLL] Found ${data.length} new items`);
    
    res.json({ success: true, data });
});

api.put('/checkin/:id/toggle-gadget', checkAuth, (req, res) => {
    const { id } = req.params;
    const checkin = db.prepare('SELECT gadgetCollectedAt FROM checkins WHERE id = ?').get(id);
    if (!checkin) return res.status(404).json({ errors: [{ message: 'Not found' }] });
    const newValue = checkin.gadgetCollectedAt ? null : new Date().toISOString().replace('T', ' ').split('.')[0];
    db.prepare('UPDATE checkins SET gadgetCollectedAt = ? WHERE id = ?').run(newValue, id);
    res.json({ success: true, collectedAt: newValue });
});

api.put('/checkin/:id/serve-gadget', checkAuth, (req, res) => {
    db.prepare('UPDATE checkins SET gadgetCollectedAt = datetime("now") WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

api.get('/checkin/lists', checkAuth, async (req, res) => {
    const fzRes = await fzGet("checkin/lists", req.headers);
    res.status(fzRes.status).json(fzRes.data);
});

api.get('/checkin/search', checkAuth, async (req, res) => {
    const fzRes = await fzGet("checkin/search?" + new URLSearchParams(req.query).toString(), req.headers);
    res.status(fzRes.status).json(fzRes.data);
});

api.get('/membership/aps-join-module', checkAuth, async (req, res) => {
    try {
        const query = new URLSearchParams(req.query);
        let id = query.get('id') || query.get('userId');

        const fzRes = await fzGet(`membership/aps-join-module?userId=${id}`, req.headers)
        const body = fzRes.data;

        res.status(fzRes.status);
        res.set('Content-Type', "text/html");
        return res.send(body);
    } catch (err) {
        console.error("[APS MODULE ERROR]", err.message);
        return res.status(500).send('Failed to load APS module');
    }
});

api.post('/checkin/redeem', async (req, res) => {
    try {
        const fzRes = await fzPost("checkin/redeem", req.body, req.headers);
        if (fzRes.status === 200 && fzRes.data?.status === 'ok') {
            const d = fzRes.data;
            console.log(`[REDEEM SUCCESS] Order: ${d.orderCode}, User: ${d.user?.fursonaName}`);
            
            try {
                const stmt = db.prepare(`INSERT INTO checkins (checkinId, checkinNonce, checkinListId, fursonaName, firstName, lastName, orderSerial, orderCode, gadgets, shirtSize, portaBadgeType, lanyardType, hasFursuitBadge, shouldPrintApsJoinModule, propicUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                const result = stmt.run(
                    d.user?.userId, 
                    d.checkinNonce, 
                    req.body.checkinListIds[0], 
                    d.user?.fursonaName || 'Unknown', 
                    d.firstName || '', 
                    d.lastName || '', 
                    d.orderSerial || 0, 
                    d.orderCode || '', 
                    JSON.stringify(d.gadgets || []), 
                    d.shirtSize || '', 
                    d.portaBadgeType || '', 
                    d.lanyardType || '', 
                    d.hasFursuitBadge ? 1 : 0, 
                    d.shouldPrintApsJoinModule ? 1 : 0, 
                    d.user?.propic?.mediaUrl || null
                );
                console.log(`[DB INSERT] Check-in saved with ID: ${result.lastInsertRowid}`);
            } catch (dbErr) {
                console.error("[DB ERROR] Failed to save check-in:", dbErr.message);
                // We don't fail the request because the remote redeem succeeded
            }
        }
        res.status(fzRes.status).json(fzRes.data);
    } catch (err) {
        console.error("[REDEEM ERROR]", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

api.post('/proxy/authentication/login', async (req, res) => {
    const fzRes = await fzPost("authentication/login", req.body, req.headers);
    if (fzRes.data?.accessToken) return res.json({ token: fzRes.data.accessToken });
    res.status(fzRes.status).json(fzRes.data);
});

app.use('/api', api);

app.use((req, res) => {
    console.error(`[404] Rotta non trovata: ${req.method} ${req.originalUrl}`);
    res.status(404).send(`Cannot ${req.method} ${req.url}`);
});

app.listen(port, () => {
    console.log('==========================================');
    console.log(` SERVER IN ASCOLTO SU http://localhost:${port}`);
    console.log('==========================================');
});
