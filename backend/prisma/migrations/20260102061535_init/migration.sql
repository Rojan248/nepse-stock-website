-- CreateTable
CREATE TABLE "Stock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "sector" TEXT,
    "lastTradedPrice" REAL,
    "previousClose" REAL,
    "openPrice" REAL,
    "highPrice" REAL,
    "lowPrice" REAL,
    "volume" REAL,
    "totalTrades" INTEGER,
    "turnover" REAL,
    "change" REAL,
    "percentageChange" REAL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MarketHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "closePrice" REAL,
    "highPrice" REAL,
    "lowPrice" REAL,
    "volume" REAL,
    "turnover" REAL,
    "change" REAL,
    "percentageChange" REAL,
    CONSTRAINT "MarketHistory_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Stock" ("symbol") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketSummary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "totalTurnover" REAL,
    "totalVolume" REAL,
    "totalTransactions" REAL,
    "activeCompanies" INTEGER,
    "advancedCompanies" INTEGER,
    "declinedCompanies" INTEGER,
    "unchangedCompanies" INTEGER,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Ipo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "sector" TEXT,
    "issueDate" DATETIME,
    "closingDate" DATETIME,
    "price" REAL,
    "units" INTEGER,
    "status" TEXT,
    "issueManager" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Stock_symbol_key" ON "Stock"("symbol");

-- CreateIndex
CREATE INDEX "MarketHistory_symbol_date_idx" ON "MarketHistory"("symbol", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Ipo_symbol_key" ON "Ipo"("symbol");
