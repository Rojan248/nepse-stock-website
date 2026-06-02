CREATE TABLE "AiRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobType" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "model" TEXT,
    "provider" TEXT,
    "requestedStocks" INTEGER NOT NULL DEFAULT 0,
    "generatedStocks" INTEGER NOT NULL DEFAULT 0,
    "reusedStocks" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "promptCacheHitTokens" INTEGER NOT NULL DEFAULT 0,
    "promptCacheMissTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" REAL,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "StockAiSummary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME,
    "summary" TEXT NOT NULL,
    "sentiment" TEXT,
    "confidence" REAL,
    "driversJson" TEXT,
    "risksJson" TEXT,
    "inputHash" TEXT NOT NULL,
    "reusedFromId" INTEGER,
    "runId" INTEGER,
    "model" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "MarketAiSummary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "periodType" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "summary" TEXT NOT NULL,
    "sentiment" TEXT,
    "confidence" REAL,
    "breadthJson" TEXT,
    "topMoversJson" TEXT,
    "sectorJson" TEXT,
    "inputHash" TEXT NOT NULL,
    "runId" INTEGER,
    "model" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "TradingSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tradingDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT,
    "stockCount" INTEGER NOT NULL DEFAULT 0,
    "marketSummaryId" INTEGER,
    "openedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AiRun_jobType_periodType_idx" ON "AiRun"("jobType", "periodType");
CREATE INDEX "AiRun_status_idx" ON "AiRun"("status");
CREATE INDEX "AiRun_startedAt_idx" ON "AiRun"("startedAt");

CREATE UNIQUE INDEX "StockAiSummary_symbol_periodType_periodStart_key" ON "StockAiSummary"("symbol", "periodType", "periodStart");
CREATE INDEX "StockAiSummary_symbol_idx" ON "StockAiSummary"("symbol");
CREATE INDEX "StockAiSummary_periodType_periodStart_idx" ON "StockAiSummary"("periodType", "periodStart");
CREATE INDEX "StockAiSummary_inputHash_idx" ON "StockAiSummary"("inputHash");

CREATE UNIQUE INDEX "MarketAiSummary_periodType_periodStart_key" ON "MarketAiSummary"("periodType", "periodStart");
CREATE INDEX "MarketAiSummary_periodType_idx" ON "MarketAiSummary"("periodType");
CREATE INDEX "MarketAiSummary_periodStart_idx" ON "MarketAiSummary"("periodStart");
CREATE INDEX "MarketAiSummary_inputHash_idx" ON "MarketAiSummary"("inputHash");

CREATE UNIQUE INDEX "TradingSession_tradingDate_key" ON "TradingSession"("tradingDate");
CREATE INDEX "TradingSession_status_idx" ON "TradingSession"("status");
CREATE INDEX "TradingSession_tradingDate_idx" ON "TradingSession"("tradingDate");
