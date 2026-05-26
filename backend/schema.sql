CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    checkinNonce TEXT UNIQUE NOT NULL,
    checkinListId INTEGER NOT NULL,
    fursonaName TEXT NOT NULL,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    orderSerial INTEGER NOT NULL,
    orderCode TEXT UNIQUE NOT NULL,
    gadgets TEXT NULL,
    shirtSize TEXT NULL,
    lanyardType TEXT NULL,
    portaBadgeType TEXT NULL,
    hasFursuitBadge INTEGER NOT NULL DEFAULT 0,
    shouldPrintApsJoinModule INTEGER NOT NULL DEFAULT 0,
    propicUrl TEXT NULL,
    operatorId INTEGER NOT NULL,
    gadgetCollectedAt TEXT DEFAULT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gadgetCollectedAt ON checkins(gadgetCollectedAt);
CREATE INDEX IF NOT EXISTS idx_checkinNonce ON checkins(checkinNonce);