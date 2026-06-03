/**
 * Backfill daily NEPSE index history into MarketSummary.
 *
 * Source: https://nepsedata.com/processed_data.json
 * Available fields: date, NEPSE index close, market capitalization, turnover.
 * Point and percent changes are computed from the previous trading row.
 */

require('dotenv').config();

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { log, error, printJson } = require('./scriptUtils');

const prisma = new PrismaClient();
const SOURCE_URL = 'https://nepsedata.com/processed_data.json';
const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');

function getArgValue(name) {
    const idx = ARGS.indexOf(name);
    return idx === -1 ? null : ARGS[idx + 1];
}

const FROM = getArgValue('--from');
const TO = getArgValue('--to');

function parseNumber(value) {
    if (value == null || value === '') return null;
    const parsed = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
}

function parseBusinessDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dayRange(date) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
}

function isWithinRequestedRange(date) {
    const day = date.toISOString().slice(0, 10);
    if (FROM && day < FROM) return false;
    if (TO && day > TO) return false;
    return true;
}

function parseMarketSummaryCandidate(row) {
    return {
        date: parseBusinessDate(row.time || row.ad_short),
        indexValue: parseNumber(row.val_index),
        totalTurnover: parseNumber(row.turnover)
    };
}

function isValidMarketSummaryCandidate(row) {
    return row.date && row.indexValue && row.indexValue > 0;
}

function getIndexMovement(row, previous) {
    if (!previous?.indexValue) {
        return { indexChange: null, indexChangePercent: null };
    }

    const indexChange = row.indexValue - previous.indexValue;
    return {
        indexChange: Number(indexChange.toFixed(2)),
        indexChangePercent: Number(((indexChange / previous.indexValue) * 100).toFixed(2))
    };
}

function toStoredMarketSummaryRow(row, previous) {
    return {
        indexValue: row.indexValue,
        ...getIndexMovement(row, previous),
        totalTurnover: row.totalTurnover,
        timestamp: row.date
    };
}

function toMarketSummaryRows(rawRows) {
    const sorted = rawRows
        .map(parseMarketSummaryCandidate)
        .filter(isValidMarketSummaryCandidate)
        .filter(row => isWithinRequestedRange(row.date))
        .sort((a, b) => a.date - b.date);

    return sorted.map((row, idx) => toStoredMarketSummaryRow(row, sorted[idx - 1]));
}

async function createDailySummary(row) {
    if (!DRY_RUN) await prisma.marketSummary.create({ data: row });
    return { created: 1, updated: 0, deduped: 0 };
}

async function updateDailySummary(row, existingRows) {
    if (!DRY_RUN) {
        await prisma.marketSummary.update({
            where: { id: existingRows[0].id },
            data: row
        });
        await deleteDuplicateDailySummaries(existingRows.slice(1));
    }

    return { created: 0, updated: 1, deduped: Math.max(0, existingRows.length - 1) };
}

async function deleteDuplicateDailySummaries(duplicates) {
    if (duplicates.length === 0) return;

    await prisma.marketSummary.deleteMany({
        where: { id: { in: duplicates.map(r => r.id) } }
    });
}

async function upsertDailySummary(row) {
    const { start, end } = dayRange(row.timestamp);
    const existingRows = await prisma.marketSummary.findMany({
        where: { timestamp: { gte: start, lt: end } },
        orderBy: { id: 'asc' },
        select: { id: true }
    });

    if (existingRows.length === 0) {
        return createDailySummary(row);
    }

    return updateDailySummary(row, existingRows);
}

async function main() {
    log(`Fetching daily NEPSE index history from ${SOURCE_URL}`);
    const response = await axios.get(SOURCE_URL, {
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });

    if (!Array.isArray(response.data)) {
        throw new Error('Source did not return an array');
    }

    const rows = toMarketSummaryRows(response.data);
    if (rows.length === 0) {
        throw new Error('No valid market summary rows parsed from source');
    }

    const stats = { parsed: rows.length, created: 0, updated: 0, deduped: 0 };
    for (const row of rows) {
        const result = await upsertDailySummary(row);
        stats.created += result.created;
        stats.updated += result.updated;
        stats.deduped += result.deduped;
    }

    printJson({
        source: SOURCE_URL,
        dryRun: DRY_RUN,
        first: rows[0].timestamp.toISOString().slice(0, 10),
        last: rows[rows.length - 1].timestamp.toISOString().slice(0, 10),
        ...stats
    });
}

main()
    .catch((err) => {
        error(err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
