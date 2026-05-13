const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;
const host = '0.0.0.0';

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

//Needs trailing / !!
const BASE_URL = "https://fzbe.furizon.net/api/v1/";
const PRINTER_PROXY_BASE_URL = "http://localhost:8082/";
const PRINTER_PROXY_AUTH_USER = "changeit";
const PRINTER_PROXY_AUTH_PASS = "changeit";

async function elaborateResponse(response) {
    const data = await response.text();
    const respHeaders = response.headers;
    if (respHeaders.get('content-type')?.includes('application/json')) {
        try {
            return { data: JSON.parse(data), headers: respHeaders, status: response.status };
        } catch (e) {}
    }
    return {data, headers: respHeaders, status: response.status};
}

async function fzGet(url, reqHeaders) {
    const headers = {
        'Authorization': reqHeaders['authorization'],
        'x-operator-id': reqHeaders['x-operator-id'],
        'Referer': "http://furpanel.furizon.net/",
        'Origin': "https://furpanel.furizon.net"
    };
    const response = await fetch(BASE_URL + url, { method: 'GET', headers });
    return await elaborateResponse(response);
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
    return await elaborateResponse(response);
}

async function printProxy(html, operatorID, id, type) {
    const headers = {
        'Authorization': 'Basic ' + Buffer.from(PRINTER_PROXY_AUTH_USER + ":" + PRINTER_PROXY_AUTH_PASS).toString('base64'),
        'x-operator-id': operatorID,
        'Content-Type': 'application/json',
        'Referer': "http://furpanel.furizon.net/",
        'Origin': "https://furpanel.furizon.net"
    };
    const response = await fetch(PRINTER_PROXY_BASE_URL + "internal/print/", { 
        method: 'POST', 
        headers, 
        body: JSON.stringify({
            html,
            id,
            operatorID,
            type
        }) 
    });
    return await elaborateResponse(response);
}

function checkPermission_internal(res) {
    return res?.data?.permissions?.includes("CAN_PERFORM_CHECKINS") || false;
}

async function checkUserPermission(headers) {
    const res = await fzGet("users/display/me", headers);
    return checkPermission_internal(res);
}


// This explicit call should be done only for internal endpoints.
//  Endpoints which already hit fzbackend servers are authenticated by fzbackend itself, no need to double check
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

api.get('/checkin/lists', async (req, res) => {
    const fzRes = await fzGet("checkin/lists", req.headers);
    res.status(fzRes.status).json(fzRes.data);
});

api.get('/checkin/search', async (req, res) => {
    const fzRes = await fzGet("checkin/search?" + new URLSearchParams(req.query).toString(), req.headers);
    res.status(fzRes.status).json(fzRes.data);
});

api.get('/checkin/logs', async (req, res) => {
    const query = new URLSearchParams(req.query).toString();
    console.log(`[PROXY GET] checkin/logs?${query}`);
    const fzRes = await fzGet("checkin/logs?" + query, req.headers);
    res.status(fzRes.status).json(fzRes.data);
});

api.get('/membership/aps-join-module', async (req, res) => {
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

api.post('/badge/print', async (req, res) => {
    try {
        requestBody = req.body;
        if (!requestBody.operatorId || !requestBody.ids || !requestBody.type) {
            return res.status(400).json({ success: false, message: 'operatorId, ids and type are required' });
        }
        const joinedIds = requestBody.ids.join(',');
        //Retrieve html of the badges
        let html = null;
        switch(requestBody.type) {
            case "USER_BADGE": {
                const fzRes = await fzGet(`admin/export/badges/user?userIds=${joinedIds}`, req.headers)
                if (fzRes.status !== 200) {
                    console.error("[BADGE PRINT ERROR] Failed to retrieve user badge HTML:", fzRes);
                    return res.status(500).json({ success: false, message: 'Failed to retrieve user badge HTML' });
                }
                html = fzRes.data;
                break;
            }
            case "FURSUIT_BADGE": {
                const fzRes = await fzGet(`admin/export/badges/fursuits?fursuitIds=${joinedIds}`, req.headers)
                if (fzRes.status !== 200) {
                    console.error("[BADGE PRINT ERROR] Failed to retrieve fursuit badge HTML:", fzRes);
                    return res.status(500).json({ success: false, message: 'Failed to retrieve fursuit badge HTML' });
                }
                html = fzRes.data;
                break;
            }
            default: return res.status(400).json({ success: false, message: 'Invalid badge type' });
        }
        console.log("[BADGE PRINT] Retrieved badge HTML, sending to print proxy...");
        const printId = requestBody.operatorId + "-" + requestBody.type + "-" + joinedIds;
        const printRes = await printProxy(html, requestBody.operatorId, printId, requestBody.type);
        if (printRes.status !== 200 && printRes.status !== 204) {
            console.error("[BADGE PRINT ERROR] Failed to print badge:", printRes);
            return res.status(500).json({ success: false, message: 'Failed to print badge' });
        }
        return res.status(200).json({ success: true, message: requestBody.type + ' printed successfully' });
    } catch (err) {
        console.error("[BADGE PRINT ERROR]", err.message);
        return res.status(500).json({ success: false, message: 'Exception while printing badge' });
    }
});

api.post('/checkin/redeem', async (req, res) => {
    try {
        const fzRes = await fzPost("checkin/redeem", req.body, req.headers);
        if (fzRes.status === 200 && fzRes.data?.status === 'ok') {
            const d = fzRes.data;
            console.log(`[REDEEM SUCCESS] Order: ${d.orderCode}, User: ${d.user?.fursonaName}`);
            
            try {
                const stmt = db.prepare(`
                    INSERT INTO 
                    checkins (
                        userId,
                        checkinNonce,
                        checkinListId,
                        fursonaName,
                        firstName,
                        lastName,
                        orderSerial,
                        orderCode,
                        gadgets,
                        shirtSize,
                        portaBadgeType,
                        lanyardType,
                        hasFursuitBadge,
                        shouldPrintApsJoinModule,
                        propicUrl,
                        operatorId
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(orderCode) DO UPDATE SET
                        userId=?,
                        checkinNonce=?,
                        checkinListId=?,
                        fursonaName=?,
                        firstName=?,
                        lastName=?,
                        orderSerial=?,
                        gadgets=?,
                        shirtSize=?,
                        portaBadgeType=?,
                        lanyardType=?,
                        hasFursuitBadge=?,
                        shouldPrintApsJoinModule=?,
                        propicUrl=?,
                        operatorId=?
                `);
                const userId = d.user?.userId
                const checkinNonce = d.checkinNonce
                const checkinListId = req.body.checkinListIds[0]           
                const fursonaName = d.user?.fursonaName || '-'
                const firstName = d.firstName || ''
                const lastName = d.lastName || ''
                const orderSerial = d.orderSerial || 0
                const orderCode = d.orderCode || ''
                const gadgets = JSON.stringify(d.gadgets || [])
                const shirtSize = d.shirtSize || ''
                const portaBadgeType = d.portaBadgeType || ''
                const lanyardType = d.lanyardType || ''
                const hasFursuitBadge = d.hasFursuitBadge ? 1 : 0
                const shouldPrintApsJoinModule = d.shouldPrintApsJoinModule ? 1 : 0
                const propicUrl =  d.user?.propic?.mediaUrl || null
                const operatorId = req.body.operatorId || -1 
                const result = stmt.run(
                    userId, checkinNonce, checkinListId, 
                    fursonaName, firstName, lastName, 
                    orderSerial, orderCode, 
                    gadgets, shirtSize, portaBadgeType, lanyardType, 
                    hasFursuitBadge, shouldPrintApsJoinModule, 
                    propicUrl, operatorId,

                    userId, checkinNonce, checkinListId, 
                    fursonaName, firstName, lastName, 
                    orderSerial, 
                    gadgets, shirtSize, portaBadgeType, lanyardType, 
                    hasFursuitBadge, shouldPrintApsJoinModule, 
                    propicUrl, operatorId,
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

api.post('/checkin/cancel', async (req, res) => {
    const fzRes = await fzPost("checkin/cancel", req.body, req.headers);
    res.status(fzRes.status).json(fzRes.data);
});

api.post('/proxy/authentication/login', async (req, res) => {
    const fzResLogin = await fzPost("authentication/login", req.body, req.headers);
    if (fzResLogin.data?.accessToken) {
        const newHeaders = {};
        Object.assign(newHeaders, req.headers);
        newHeaders['authorization'] = 'Bearer ' + fzResLogin.data.accessToken;
        const fzResUser = await fzGet("users/display/me", newHeaders);
        const hasPermission = checkPermission_internal(fzResUser);
        if (!hasPermission) {
            return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        }
        return res.json({
            token: fzResLogin.data.accessToken,
            userId: fzResLogin.data.userId,
            userName: fzResUser.data.display.fursonaName || '-'
        });
    }
    res.status(fzResLogin.status).json(fzResLogin.data);
});

app.use('/api', api);

app.use((req, res) => {
    console.error(`[404] Rotta non trovata: ${req.method} ${req.originalUrl}`);
    res.status(404).send(`Cannot ${req.method} ${req.url}`);
});

app.listen(port, host, () => {
    console.log('==========================================');
    console.log(` SERVER IN ASCOLTO SU http://${host}:${port}`);
    console.log('==========================================');
});
