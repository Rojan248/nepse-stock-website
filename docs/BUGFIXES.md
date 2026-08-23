# Bug Fixes Log

Bugs found through live end-to-end testing of the data pipeline (2026-08-22), with root causes and fixes. Each entry was reproduced against real NEPSE sources before and after the fix.

## 1. Fresh installs fail to persist stocks (`lastSource` column missing)

| | |
|---|---|
| **Area** | Database migrations |
| **Symptom** | Every scheduler cycle fails: `Invalid prisma.stock.upsert() invocation: The column "lastSource" does not exist in the current database.` No stocks, IPOs, or market summaries are ever saved on a fresh database. |
| **Root cause** | `Stock.lastSource` exists in `prisma/schema.prisma` but was never captured in a migration file. `prisma migrate deploy` creates a database without the column, while the generated Prisma client expects it. CI did not catch this because tests mock the Prisma layer instead of running against a migrated SQLite file. |
| **Evidence** | Server log during live run: fetch succeeded (280 stocks from official NEPSE API) → save failed every cycle. |
| **Fix** | Added migration `backend/prisma/migrations/20260822160000_add_stock_last_source/migration.sql` — `ALTER TABLE "Stock" ADD COLUMN "lastSource" TEXT;` |

## 2. Merolagani scraper false positive on non-trading days

| | |
|---|---|
| **Area** | Market meta scraping (`extractTransactionFromHTML`) |
| **Symptom** | On weekends/holidays, Merolagani's page contains no "Total Transactions" section at all, yet the parser reported `totalTransactions: 21` — an implausible value that could be persisted into market summaries via `patchMissingTotals`. |
| **Root cause** | Two stacked problems in the regex fallback chain: (1) the second pattern `/Transactions[^0-9]*([0-9,]+)/i` matched *any* occurrence of the word "transactions" followed by digits anywhere in the markup; (2) no plausibility check accepted any value `> 0`. |
| **Evidence** | Live probe against `https://merolagani.com/MarketSummary.aspx` on a Saturday: page = 64,956 bytes, zero occurrences of "Total Transactions", strict parser correctly returned all nulls — but `extractTransactionFromHTML` returned `{ totalTransactions: 21 }`. For comparison, a real session clears ~50k+ transactions (Friday's verified total: 59,805). |
| **Fix** | In `backend/src/services/utils/marketDataHelpers.js`: removed the loose "any transactions + number" pattern (strict "Total Transactions" match only) and added a plausibility floor — matches below 1,000 transactions are rejected as markup noise. |

Regression tests for both scenarios live in `backend/tests/unit/marketDataHelpers.test.js`.

## 3. Two more Stock columns missing from migrations (`percentageChange1W` / `percentageChange1M`)

| | |
|---|---|
| **Area** | Database migrations |
| **Symptom** | Same failure class as Bug 1, one layer deeper: fresh databases lack `Stock.percentageChange1W` and `Stock.percentageChange1M`, so any write touching those fields fails after Bug 1's fix. |
| **Root cause** | The columns exist in `prisma/schema.prisma` but were never captured in a migration — confirming this was a recurring process gap, not a one-off. |
| **Evidence** | Found immediately by the new migration-drift CI check on its first run against the repo. |
| **Fix** | Migration `backend/prisma/migrations/20260822170000_add_stock_week_month_changes/migration.sql`. |

## Hardening applied alongside these fixes

| Risk | Mitigation |
|---|---|
| Pre-open sessions legitimately report tiny transaction counts, which the plausibility floor would reject | `extractTransactionFromHTML` accepts a caller-supplied floor; `marketMetaFetcher` lowers it to 10 during `PRE_OPEN` market state only |
| Mock data could silently pollute a production database (`USE_MOCK_DATA=true`) | Boot-time validation now refuses to start in production with mock mode enabled (same fail-fast path as weak secrets) |
| Schema drift (Bug 1's root cause class) is invisible to CI because tests mock Prisma | CI runs `npm run check:migrations` ([`backend/scripts/check-migrations.js`](../backend/scripts/check-migrations.js)) so any schema field without a migration column fails the build. `prisma migrate diff --exit-code` was evaluated and rejected: on SQLite it reports cosmetic "redefined table" noise even on a clean tree |
| SQLite writer contention between scheduler, watchdog, and user writes can raise `SQLITE_BUSY` | Connection now sets `PRAGMA busy_timeout=5000` alongside WAL mode |
| Prisma failures logged with effectively empty messages made Bug 1 hard to diagnose from logs alone | Scheduler and stock-save error paths log through a shared `describeError` formatter that includes the Prisma error code and a compact single-line message |

## Operational cautions

- **Before running migrations on an existing production database**, back up the SQLite file. If the live database was ever created with `prisma db push` instead of migrations, `migrate deploy` will attempt to replay history; use `prisma migrate resolve` to baseline it first.
- The transaction-count floor of 1,000 applies outside pre-open. If NEPSE ever changes session structure, revisit `MIN_PLAUSIBLE_TRANSACTIONS`.

## Known behavior (not bugs)

- `POST /api/force-update` does not bypass closed-market gating: on WEEKEND/HOLIDAY the update is skipped unless dev/mock mode is active. This protects NEPSE's API from pointless traffic but means "force" cannot seed data outside market days.
- The scheduler skips all fetching on WEEKEND/HOLIDAY by design; freshness limits in `/api/health/ready` widen accordingly (24h).
