-- CreateTable
CREATE TABLE "StockMetrics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "priceMetrics" TEXT,
    "trendMetrics" TEXT,
    "momentumMetrics" TEXT,
    "liquidityMetrics" TEXT,
    "relativeMetrics" TEXT,
    "fundamentals" TEXT,
    "patterns" TEXT,
    "signals" TEXT,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AIOverview" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'stock',
    "context" TEXT,
    "narrative" TEXT,
    "modelVersion" TEXT,
    "tokenCount" INTEGER,
    "triggeredBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "StockMetrics_symbol_idx" ON "StockMetrics"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "StockMetrics_symbol_date_key" ON "StockMetrics"("symbol", "date");

-- CreateIndex
CREATE INDEX "AIOverview_symbol_idx" ON "AIOverview"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "AIOverview_symbol_type_key" ON "AIOverview"("symbol", "type");
