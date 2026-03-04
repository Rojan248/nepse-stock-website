-- AlterTable
ALTER TABLE "MarketHistory" ADD COLUMN "openPrice" REAL;

-- AlterTable
ALTER TABLE "Stock" ADD COLUMN "high52w" REAL;
ALTER TABLE "Stock" ADD COLUMN "low52w" REAL;
ALTER TABLE "Stock" ADD COLUMN "nepseSecurityId" TEXT;
