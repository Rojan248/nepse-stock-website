const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { acquireLock, releaseLock } = require('../utils/updateLock');
const merolagani = require('./providers/MerolaganiProvider');
const nepseAlpha = require('./providers/NepseAlphaProvider');
const dataFetcher = require('../dataFetcher');
const { sendAlert } = require('../utils/alertService');

const prisma = new PrismaClient();
const LOG_FILE = path.join(__dirname, '../../../logs/watchdog_verification.json');

class WatchdogService {
    constructor() {
        this.providers = [merolagani, nepseAlpha];
        this.consecutiveCriticalErrors = 0;  // 3-Strike Rule state
        this.ALERT_THRESHOLD = 3;             // Alert after 3 failures (30 mins)
    }

    /**
     * Run a full verification cycle
     */
    async verify() {
        logger.info('[Watchdog] Starting verification cycle...');

        // 1. Get Local Data (Source of Truth for our App)
        const localData = await this.getLocalData();

        // 2. Get External Data
        const externalData = await Promise.all(
            this.providers.map(p => p.fetchMarketSummary())
        );

        // 3. Compare
        const report = this.generateReport(localData, externalData);

        // 4. Auto-Correction Logic
        if (report.status !== 'OK' || (localData && localData.data.breadth.advanced === 0 && localData.data.breadth.declined === 0)) {
            logger.warn(`[Watchdog] Issues detected or Zero Breadth. Attempting auto-correction...`);
            await this.attemptCorrection(report);
        }

        // 5. Check for Stale Data
        if (localData) {
            const lastUpdate = new Date(localData.timestamp);
            const now = new Date();
            const hoursDiff = (now - lastUpdate) / (1000 * 60 * 60);

            // If data is older than 24 hours and it's a trading day (Sun-Thu), warn
            const day = now.getDay();
            const isTradingDay = day >= 0 && day <= 4; // Sun=0, Thu=4

            if (hoursDiff > 24 && isTradingDay) {
                report.status = report.status === 'OK' ? 'WARNING' : report.status;
                report.discrepancies.push(`Local data is stale (${hoursDiff.toFixed(1)} hours old)`);
            }
        }

        // 6. Handle Alerting (3-Strike Rule)
        await this.handleAlerting(report);

        // 7. Log Report
        await this.saveReport(report);

        logger.info('[Watchdog] Verification completed.');
        return report;
    }

    /**
     * 3-Strike Alerting: Only alert after 3 consecutive CRITICAL failures
     * Prevents notification spam from transient network issues
     */
    async handleAlerting(report) {
        if (report.status === 'CRITICAL') {
            this.consecutiveCriticalErrors++;
            logger.warn(`[Watchdog] Critical Strike ${this.consecutiveCriticalErrors}/${this.ALERT_THRESHOLD}`);

            // Trigger alert only on the 3rd consecutive failure
            if (this.consecutiveCriticalErrors === this.ALERT_THRESHOLD) {
                const msg = `🚨 **CRITICAL DATA ISSUE**\nWatchdog detected serious issues for ${this.ALERT_THRESHOLD} cycles (${this.ALERT_THRESHOLD * 10} mins).\n\n**Issues:**\n${report.discrepancies.join('\n')}`;
                await sendAlert(msg, 'error', 'watchdog_critical');
            }
        } else {
            // Reset counter if data returns to normal (Self-Healing)
            if (this.consecutiveCriticalErrors > 0) {
                logger.info('[Watchdog] Data normalized. Strike count reset.');
                // Optional: Send recovery notification
                if (this.consecutiveCriticalErrors >= this.ALERT_THRESHOLD) {
                    await sendAlert('✅ Watchdog: Data integrity restored', 'success', 'watchdog_recovered');
                }
            }
            this.consecutiveCriticalErrors = 0;
        }
    }

    async attemptCorrection(report) {
        try {
            // Acquire lock to prevent scheduler from overwriting our corrections
            if (!acquireLock('watchdog')) {
                logger.warn('[Watchdog] Could not acquire lock, skipping correction');
                return;
            }

            // Scenario 1: Local data is zeroed out (0 Adv/0 Dec)
            // This usually happens when the live feed resets but we want to show the last close
            const localBreadth = report.local?.data?.breadth;
            const isZeroed = localBreadth && localBreadth.advanced === 0 && localBreadth.declined === 0;

            if (isZeroed) {
                logger.info('[Watchdog] Local breadth is zeroed. Fetching previous trading day data...');
                const previousData = await dataFetcher.fetchPreviousTradingDayData();

                if (previousData) {
                    logger.info(`[Watchdog] Found valid previous data: Adv=${previousData.advanced}, Dec=${previousData.declined}`);

                    // Update the latest market summary
                    const latestSummary = await prisma.marketSummary.findFirst({
                        orderBy: { timestamp: 'desc' }
                    });

                    if (latestSummary) {
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
                }
            }

            // Release lock after correction
            releaseLock('watchdog');
        } catch (e) {
            releaseLock('watchdog');
            logger.error(`[Watchdog] Correction failed: ${e.message}`);
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
            status: 'OK', // OK, WARNING, CRITICAL
            discrepancies: [],
            local: local,
            external: external
        };

        if (!local) {
            report.status = 'CRITICAL';
            report.discrepancies.push('Local database is empty or inaccessible');
            return report;
        }

        const TOLERANCE_PERCENT = 1.0;

        // Check if we have ANY valid external data
        const validExternal = external.filter(e => e && e.data && !e.error && e.status !== 'skipped');

        if (validExternal.length === 0) {
            report.status = 'WARNING';
            report.discrepancies.push('No valid external data available for verification');
            return report;
        }

        // Compare with Merolagani (if available)
        const m = validExternal.find(e => e.source === 'Merolagani');
        if (m && m.data) {
            // Compare Turnover
            if (m.data.totalTurnover && local.data.totalTurnover) {
                const diff = Math.abs(m.data.totalTurnover - local.data.totalTurnover);
                const pct = (diff / local.data.totalTurnover) * 100;

                if (pct > TOLERANCE_PERCENT) {
                    report.status = 'WARNING';
                    report.discrepancies.push(`Turnover mismatch: Local=${local.data.totalTurnover}, Merolagani=${m.data.totalTurnover} (${pct.toFixed(2)}% diff)`);
                }
            }

            // Compare Transactions
            if (m.data.totalTransactions && local.data.totalTransactions) {
                const diff = Math.abs(m.data.totalTransactions - local.data.totalTransactions);
                const pct = (diff / local.data.totalTransactions) * 100;

                if (pct > TOLERANCE_PERCENT) {
                    report.status = 'WARNING';
                    report.discrepancies.push(`Transactions mismatch: Local=${local.data.totalTransactions}, Merolagani=${m.data.totalTransactions} (${pct.toFixed(2)}% diff)`);
                }
            }
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
                // File might not exist or be corrupt, start fresh
            }

            // Keep last 50 reports
            logs.unshift(report);
            if (logs.length > 50) logs = logs.slice(0, 50);

            await fs.promises.writeFile(LOG_FILE, JSON.stringify(logs, null, 2));
        } catch (error) {
            logger.error(`[Watchdog] Failed to save report: ${error.message}`);
        }
    }
}

module.exports = new WatchdogService();
