-- Align migration history with the current Prisma schema.

-- Alert lifecycle metadata
ALTER TABLE "Alert" ADD COLUMN "triggeredAt" DATETIME;

-- Market history should be unique per symbol/day for reliable upserts.
DROP INDEX IF EXISTS "MarketHistory_symbol_date_idx";
CREATE UNIQUE INDEX "MarketHistory_symbol_date_key" ON "MarketHistory"("symbol", "date");
CREATE INDEX "MarketHistory_symbol_idx" ON "MarketHistory"("symbol");

-- Distributed scheduler/update locks
CREATE TABLE "Lock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Daily AI usage budget tracking
CREATE TABLE "AIUsage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "costUSD" REAL NOT NULL DEFAULT 0,
    "callCount" INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX "AIUsage_date_key" ON "AIUsage"("date");
