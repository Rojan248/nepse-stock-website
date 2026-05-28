#!/usr/bin/env node
/**
 * Keep stock master data limited to active ordinary shares.
 *
 * Uses NEPSE's official company directory and keeps only records with:
 *   status: A
 *   instrumentType: Equity
 *
 * Usage:
 *   node scripts/sync-ordinary-shares.js --dry-run
 *   node scripts/sync-ordinary-shares.js
 */

const { PrismaClient } = require('@prisma/client');
const { printJson, log } = require('./scriptUtils');
const {
    fetchOfficialCompanyList,
    buildOrdinaryShareMap
} = require('../src/services/nepseCompanyDirectory');
const { normalizeSymbol } = require('../src/services/dataEnricher');

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

function stockDataFromCompany(company) {
    const symbol = normalizeSymbol(company.symbol);
    return {
        symbol,
        companyName: company.securityName || company.companyName || symbol,
        sector: company.sectorName || null,
        nepseSecurityId: company.id != null ? String(company.id) : null
    };
}

function shouldUpdateStock(stock, company) {
    const data = stockDataFromCompany(company);
    return stock.companyName !== data.companyName
        || stock.sector !== data.sector
        || stock.nepseSecurityId !== data.nepseSecurityId;
}

async function deleteSymbols(tx, symbols) {
    if (symbols.length === 0) return;

    await tx.marketHistory.deleteMany({ where: { symbol: { in: symbols } } });
    await tx.stockMetrics.deleteMany({ where: { symbol: { in: symbols } } });
    await tx.stock.deleteMany({ where: { symbol: { in: symbols } } });
}

async function syncOrdinaryShares() {
    log('Fetching official NEPSE company directory...');
    const companyList = await fetchOfficialCompanyList();
    const ordinaryShareMap = buildOrdinaryShareMap(companyList);
    const dbStocks = await prisma.stock.findMany({
        select: {
            symbol: true,
            companyName: true,
            sector: true,
            nepseSecurityId: true
        },
        orderBy: { symbol: 'asc' }
    });

    const dbSymbolSet = new Set(dbStocks.map(stock => normalizeSymbol(stock.symbol)));
    const ordinarySymbols = new Set(ordinaryShareMap.keys());
    const removeSymbols = dbStocks
        .map(stock => normalizeSymbol(stock.symbol))
        .filter(symbol => !ordinarySymbols.has(symbol));
    const addCompanies = Array.from(ordinaryShareMap.entries())
        .filter(([symbol]) => !dbSymbolSet.has(symbol))
        .map(([, company]) => company)
        .sort((a, b) => normalizeSymbol(a.symbol).localeCompare(normalizeSymbol(b.symbol)));
    const updateStocks = dbStocks
        .filter(stock => ordinaryShareMap.has(normalizeSymbol(stock.symbol)))
        .filter(stock => shouldUpdateStock(stock, ordinaryShareMap.get(normalizeSymbol(stock.symbol))));

    const result = {
        dryRun: DRY_RUN,
        officialActiveOrdinaryShares: ordinaryShareMap.size,
        existingStocks: dbStocks.length,
        toRemove: removeSymbols.length,
        toAdd: addCompanies.length,
        toUpdate: updateStocks.length,
        removeSymbols,
        addSymbols: addCompanies.map(company => normalizeSymbol(company.symbol)),
        updateSymbols: updateStocks.map(stock => normalizeSymbol(stock.symbol))
    };

    if (DRY_RUN) {
        printJson(result);
        return result;
    }

    await prisma.$transaction(async (tx) => {
        await deleteSymbols(tx, removeSymbols);

        for (const company of addCompanies) {
            await tx.stock.create({ data: stockDataFromCompany(company) });
        }

        for (const stock of updateStocks) {
            const symbol = normalizeSymbol(stock.symbol);
            await tx.stock.update({
                where: { symbol },
                data: stockDataFromCompany(ordinaryShareMap.get(symbol))
            });
        }
    }, { timeout: 60000, maxWait: 10000 });

    const remaining = await prisma.stock.count();
    printJson({ ...result, remaining });
    return result;
}

syncOrdinaryShares()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
