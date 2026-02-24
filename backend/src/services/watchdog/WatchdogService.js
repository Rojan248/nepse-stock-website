const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const merolagani = require('./providers/MerolaganiProvider');
const nepseAlpha = require('./providers/NepseAlphaProvider');
const dataFetcher = require('../dataFetcher');

const prisma = new PrismaClient();
const LOG_FILE = path.join(__dirname, '../../../logs/watchdog_verification.json');

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

class WatchdogService {
    constructor() {
        this.providers = [merolagani, nepseAlpha];
    }

    /**
     * Run a full verification cycle
     */
    async verify() {
        logger.info('[Watchdog] Starting verification cycle...');

        const localData = await this.getLocalData();
        const externalData = await Promise.all(
            this.providers.map(p => p.fetchMarketSummary())
        );

        const report = this.generateReport(localData, externalData);

        if (needsCorrection(report, localData)) {
            logger.warn('[Watchdog] Issues detected or Zero Breadth. Attempting auto-correction...');
            await this.attemptCorrection(report);
        }

        applyStaleDataWarning(report, localData);

        await this.saveReport(report);
        logger.info('[Watchdog] Verification completed.');
        return report;
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

        const m = external.find(e => e.source === 'Merolagani');
        if (m && m.data) {
            addDiscrepancyIfMismatch({ report, localValue: local.data.totalTurnover, externalValue: m.data.totalTurnover, metricName: 'Turnover', sourceName: 'Merolagani' });
            addDiscrepancyIfMismatch({ report, localValue: local.data.totalTransactions, externalValue: m.data.totalTransactions, metricName: 'Transactions', sourceName: 'Merolagani' });
        }

        return report;
    }

    async saveReport(report) {
        try {
            let logs = [];
            try {
                const content = await fs.promises.readFile(LOG_FILE, 'utf8');
                logs = JSON.parse(content);
                if (!Array.isArray(logs)) logs = [];
            } catch (e) {
                // ignore missing or corrupt file
            }

            logs.unshift(report);
            if (logs.length > 50) logs = logs.slice(0, 50);

            await fs.promises.writeFile(LOG_FILE, JSON.stringify(logs, null, 2));
        } catch (error) {
            logger.error(`[Watchdog] Failed to save report: ${error.message}`);
        }
    }
}

module.exports = new WatchdogService();
