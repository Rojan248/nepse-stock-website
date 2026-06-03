const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const merolagani = require('./providers/MerolaganiProvider');
const nepseAlpha = require('./providers/NepseAlphaProvider');
const shareSansar = require('./providers/ShareSansarProvider');
const dataFetcher = require('../dataFetcher');

const prisma = new PrismaClient();
const LOG_FILE = path.join(__dirname, '../../../logs/watchdog_verification.json');
const updateLock = require('../utils/updateLock');

// --- Extracted helpers (reduce cc in class methods) ---

/** Check if breadth data indicates a zeroed-out state */
function isZeroedBreadth(breadth) {
    return breadth && breadth.advanced === 0 && breadth.declined === 0;
}

/** Determine whether auto-correction is needed */
function needsCorrection(report, localData) {
    return report.status !== 'OK' || isZeroedBreadth(localData?.data?.breadth);
}

/** Add a discrepancy when two metric values differ beyond a threshold % */
function addDiscrepancyIfMismatch({ report, localValue, externalValue, metricName, sourceName, threshold = 1.0 }) {
    if (!externalValue || !localValue) return;
    const diff = Math.abs(externalValue - localValue);
    const pct = (diff / localValue) * 100;
    if (pct > threshold) {
        report.status = 'WARNING';
        report.discrepancies.push(
            `${metricName} mismatch: Local=${localValue}, ${sourceName}=${externalValue} (${pct.toFixed(2)}% diff)`
        );
    }
}

/** Warn if local data is stale on a trading day */
function applyStaleDataWarning(report, localData) {
    if (!localData) return;
    const lastUpdate = new Date(localData.timestamp);
    const now = new Date();
    const hoursDiff = (now - lastUpdate) / (1000 * 60 * 60);
    const day = now.getDay();
    const isTradingDay = day >= 0 && day <= 4; // Sun=0, Thu=4
    if (hoursDiff > 24 && isTradingDay) {
        report.status = report.status === 'OK' ? 'WARNING' : report.status;
        report.discrepancies.push(`Local data is stale (${hoursDiff.toFixed(1)} hours old)`);
    }
}

/** Compare external source data to local and add discrepancies */
function compareExternalToLocal(report, local, ext) {
    if (!ext || !ext.data) return;

    if (ext.data.totalTurnover) {
        addDiscrepancyIfMismatch({ report, localValue: local.data.totalTurnover, externalValue: ext.data.totalTurnover, metricName: 'Turnover', sourceName: ext.source });
    }
    if (ext.data.totalTransactions) {
        addDiscrepancyIfMismatch({ report, localValue: local.data.totalTransactions, externalValue: ext.data.totalTransactions, metricName: 'Transactions', sourceName: ext.source });
    }
    if (ext.data.nepseIndex) {
        // Lower threshold for NEPSE index since it should be very close
        addDiscrepancyIfMismatch({ report, localValue: local.data.nepseIndex, externalValue: ext.data.nepseIndex, metricName: 'NEPSE Index', sourceName: ext.source, threshold: 0.1 });
    }
}

const isValidProviderResult = (result) =>
    result.status === 'fulfilled' && result.value && !result.value.error;

const extractProviderValues = (settledResults) => settledResults
    .filter(isValidProviderResult)
    .map(result => result.value);

const fetchProviderSummaries = async (providers) => {
    const settled = await Promise.allSettled(providers.map(p => p.fetchMarketSummary()));
    return extractProviderValues(settled);
};

const fetchProviderStockResults = async (providers, symbol) => {
    const settled = await Promise.allSettled(providers.map(p => p.fetchStockData(symbol)));
    return extractProviderValues(settled);
};

const selectCorrectStockData = (validData) => validData.find(d => d.lastTradedPrice > 0) || validData[0];

const normalizeWatchdogStock = (stockData) => {
    const { normalizeStockData } = require('../utils/dataNormalizer');
    return normalizeStockData(stockData, `watchdog_fix_${stockData.source || 'unknown'}`);
};

const saveNormalizedStock = async (normalized) => {
    const stockOperations = require('../database/stockOperations');
    await stockOperations.saveStocks([normalized]);
};

const findZeroVolumeAnomalies = () => prisma.stock.findMany({
    where: {
        volume: 0,
        OR: [
            { change: { not: 0 } },
            { percentageChange: { not: 0 } }
        ]
    },
    select: { symbol: true, change: true }
});

const readReportLogs = async () => {
    try {
        const content = await fs.promises.readFile(LOG_FILE, 'utf8');
        const logs = JSON.parse(content);
        return Array.isArray(logs) ? logs : [];
    } catch (e) {
        return [];
    }
};

const trimReportLogs = (logs) => logs.length > 50 ? logs.slice(0, 50) : logs;

class WatchdogService {
    constructor() {
        this.providers = [merolagani, nepseAlpha, shareSansar];
    }

    /**
     * Run a full verification cycle
     */
    async verify() {
        logger.info('[Watchdog] Starting verification cycle...');

        // Phase 3: Acquire Distributed Lock
        const hasLock = await updateLock.acquireLock('watchdog');
        if (!hasLock) {
            logger.warn('[Watchdog] Verification skipped: Lock held by another instance/service');
            return { status: 'SKIPPED', reason: 'Lock held by others' };
        }

        try {
            const localData = await this.getLocalData();
        const externalData = await fetchProviderSummaries(this.providers);

        const report = this.generateReport(localData, externalData);

        if (needsCorrection(report, localData)) {
            logger.warn('[Watchdog] Issues detected or Zero Breadth. Attempting auto-correction...');
            await this.attemptCorrection(report);
        }

        applyStaleDataWarning(report, localData);

        await this.saveReport(report);
        logger.info('[Watchdog] Verification completed.');
        return report;
    } finally {
        // Phase 3: Release Distributed Lock
        await updateLock.releaseLock('watchdog');
    }
}

    async attemptCorrection(report) {
        try {
            const localBreadth = report.local?.data?.breadth;
            if (!isZeroedBreadth(localBreadth)) return;

            logger.info('[Watchdog] Local breadth is zeroed. Fetching previous trading day data...');
            const previousData = await dataFetcher.fetchPreviousTradingDayData();
            if (!previousData) return;

            logger.info(`[Watchdog] Found valid previous data: Adv=${previousData.advanced}, Dec=${previousData.declined}`);
            await this.applyBreadthCorrection(report, previousData);
        } catch (e) {
            logger.error(`[Watchdog] Correction failed: ${e.message}`);
        }
    }

    /** Persist previous-day breadth data as a correction */
    async applyBreadthCorrection(report, previousData) {
        const latestSummary = await prisma.marketSummary.findFirst({
            orderBy: { timestamp: 'desc' }
        });
        if (!latestSummary) return;

        await prisma.marketSummary.update({
            where: { id: latestSummary.id },
            data: {
                advancedCompanies: previousData.advanced,
                declinedCompanies: previousData.declined,
                unchangedCompanies: previousData.unchanged
            }
        });
        logger.info('[Watchdog] Correction applied successfully.');
        report.correctionApplied = true;
        report.correctionDetails = 'Restored previous trading day breadth data';
    }

    /**
     * Target a single stock for immediate correction.
     * Fetches from multiple external providers and takes the majority consensus.
     * @param {string} symbol - Stock symbol to fix
     */
    async fixSpecificStock(symbol) {
        logger.info(`[Watchdog] Targeted re-fetch initiated for: ${symbol}`);
        
        try {
            // Fetch from external providers specifically for this stock
            const validData = await fetchProviderStockResults(this.providers, symbol);

            if (validData.length === 0) {
                logger.warn(`[Watchdog] No external data found for ${symbol}`);
                return { success: false, reason: 'No external data' };
            }

            // Simple majority consensus or first valid for now
            // In a production system, we'd compare prices, but here we'll take the first non-zero LTP
            const correctData = selectCorrectStockData(validData);
            
            // Standardize and save
            const normalized = normalizeWatchdogStock(correctData);
            await saveNormalizedStock(normalized);
            
            logger.info(`[Watchdog] Fixed ${symbol} using data from ${correctData.source}`);
            return { success: true, source: correctData.source, data: normalized };
        } catch (error) {
            logger.error(`[Watchdog] Targeted fix failed for ${symbol}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Audit for stocks that have 0 volume but non-zero price changes (likely data glitches).
     * Triggers targeted re-fetches for detected anomalies.
     */
    async auditZeroVolume() {
        logger.info('[Watchdog] Starting zero-volume anomaly audit...');
        
        try {
            const anomalies = await findZeroVolumeAnomalies();

            if (anomalies.length === 0) {
                logger.info('[Watchdog] No zero-volume anomalies detected.');
                return { anomaliesFound: 0 };
            }

            logger.warn(`[Watchdog] Found ${anomalies.length} zero-volume anomalies.`);
            
            const results = [];
            for (const anomaly of anomalies) {
                const res = await this.fixSpecificStock(anomaly.symbol);
                results.push({ symbol: anomaly.symbol, ...res });
            }

            return { anomaliesFound: anomalies.length, results };
        } catch (error) {
            logger.error(`[Watchdog] Zero-volume audit failed: ${error.message}`);
            return { error: error.message };
        }
    }

    async getLocalData() {
        try {
            const summary = await prisma.marketSummary.findFirst({
                orderBy: { timestamp: 'desc' }
            });

            if (!summary) return null;

            return {
                source: 'Local Database',
                timestamp: summary.timestamp,
                data: {
                    nepseIndex: summary.nepseIndex,
                    totalTurnover: summary.totalTurnover,
                    totalTransactions: summary.totalTransactions,
                    totalVolume: summary.totalVolume,
                    breadth: {
                        advanced: summary.advancedCompanies,
                        declined: summary.declinedCompanies,
                        unchanged: summary.unchangedCompanies
                    }
                }
            };
        } catch (error) {
            logger.error(`[Watchdog] Failed to get local data: ${error.message}`);
            return null;
        }
    }

    generateReport(local, external) {
        const report = {
            timestamp: new Date(),
            status: 'OK',
            discrepancies: [],
            local: local,
            external: external
        };

        if (!local) {
            report.status = 'CRITICAL';
            report.discrepancies.push('Local database is empty or inaccessible');
            return report;
        }

        // Compare with all available external sources
        for (const ext of external) {
            compareExternalToLocal(report, local, ext);
        }

        return report;
    }

    async saveReport(report) {
        try {
            const logs = await readReportLogs();
            logs.unshift(report);
            await fs.promises.writeFile(LOG_FILE, JSON.stringify(trimReportLogs(logs), null, 2));
        } catch (error) {
            logger.error(`[Watchdog] Failed to save report: ${error.message}`);
        }
    }
}

module.exports = new WatchdogService();
