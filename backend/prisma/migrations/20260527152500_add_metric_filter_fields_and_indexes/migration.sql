-- AlterTable
ALTER TABLE "StockMetrics" ADD COLUMN "ma20" REAL;
ALTER TABLE "StockMetrics" ADD COLUMN "ma50" REAL;
ALTER TABLE "StockMetrics" ADD COLUMN "ma180" REAL;
ALTER TABLE "StockMetrics" ADD COLUMN "rsi14" REAL;
ALTER TABLE "StockMetrics" ADD COLUMN "high52w" REAL;
ALTER TABLE "StockMetrics" ADD COLUMN "low52w" REAL;

-- CreateIndex
CREATE INDEX "Stock_updatedAt_idx" ON "Stock"("updatedAt");

-- CreateIndex
CREATE INDEX "MarketHistory_date_idx" ON "MarketHistory"("date");

-- CreateIndex
CREATE INDEX "StockMetrics_date_idx" ON "StockMetrics"("date");
