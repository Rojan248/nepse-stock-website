const schedule = require('node-schedule');
const logger = require('../utils/logger');
const { getMarketState, MARKET_STATES } = require('../utils/marketTime');
const { getAiSummaryConfig } = require('../ai/aiSummaryConfig');
const { runStockSummaries } = require('../ai/stockSummaryWorker');
const { runMarketSummary } = require('../ai/marketSummaryWorker');
const { isTradingDay, isTradingDateString, toNepalDateString, getDayPeriod } = require('../ai/tradingCalendar');

let jobs = [];
let running = false;
let lastRun = null;
let lastError = null;

const addDaysToDateString = (dateString, days) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().slice(0, 10);
};

const hasFutureTradingDay = (dateString, maxDays, samePeriodPredicate) => {
    for (let i = 1; i <= maxDays; i += 1) {
        const next = addDaysToDateString(dateString, i);
        if (!samePeriodPredicate(dateString, next)) return false;
        if (isTradingDateString(next)) return true;
    }
    return false;
};

const isLastTradingDayOfWeek = (date = new Date()) => {
    const today = toNepalDateString(date);
    return !hasFutureTradingDay(today, 6, (current, next) => {
        const cur = new Date(`${current}T00:00:00Z`);
        const nxt = new Date(`${next}T00:00:00Z`);
        const curWeekStart = new Date(cur);
        curWeekStart.setUTCDate(cur.getUTCDate() - cur.getUTCDay());
        const nextWeekStart = new Date(nxt);
        nextWeekStart.setUTCDate(nxt.getUTCDate() - nxt.getUTCDay());
        return curWeekStart.toISOString().slice(0, 10) === nextWeekStart.toISOString().slice(0, 10);
    });
};

const isLastTradingDayOfMonth = (date = new Date()) => {
    const today = toNepalDateString(date);
    return !hasFutureTradingDay(today, 31, (current, next) => current.slice(0, 7) === next.slice(0, 7));
};

async function safeRun(label, task) {
    try {
        lastRun = { label, startedAt: new Date().toISOString() };
        const result = await task();
        lastRun = { ...lastRun, finishedAt: new Date().toISOString(), result };
        lastError = null;
        logger.info(`[AiSummaryScheduler] ${label} completed`);
        return result;
    } catch (error) {
        lastError = error.message;
        logger.error(`[AiSummaryScheduler] ${label} failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function runHourlyStockJob() {
    if (!isTradingDay() || getMarketState() !== MARKET_STATES.OPEN) {
        return { skipped: true, reason: 'market-not-open' };
    }
    return safeRun('hourly-stock-summary', () => runStockSummaries({ periodType: 'HOURLY' }));
}

async function runEndOfDayJobs() {
    if (!isTradingDay()) return { skipped: true, reason: 'not-trading-day' };
    const period = getDayPeriod();
    await safeRun('eod-stock-summary', () => runStockSummaries({
        periodType: 'EOD',
        periodStart: period.start,
        periodEnd: period.end
    }));
    await safeRun('daily-market-summary', () => runMarketSummary({
        periodType: 'DAILY',
        periodStart: period.start,
        periodEnd: period.end
    }));
    return { success: true };
}

async function runWeeklyJob() {
    if (!isTradingDay() || !isLastTradingDayOfWeek()) return { skipped: true, reason: 'not-last-trading-day-of-week' };
    const period = getDayPeriod();
    return safeRun('weekly-market-summary', () => runMarketSummary({
        periodType: 'WEEKLY',
        periodStart: period.start,
        periodEnd: period.end
    }));
}

async function runMonthlyJob() {
    if (!isTradingDay() || !isLastTradingDayOfMonth()) return { skipped: true, reason: 'not-last-trading-day-of-month' };
    const period = getDayPeriod();
    return safeRun('monthly-market-summary', () => runMarketSummary({
        periodType: 'MONTHLY',
        periodStart: period.start,
        periodEnd: period.end
    }));
}

function startScheduler() {
    const config = getAiSummaryConfig();
    if (!config.enabled) {
        logger.info('[AiSummaryScheduler] Disabled. Set AI_SUMMARIES_ENABLED=true to start AI jobs.');
        return;
    }
    if (running) return;

    jobs = [
        schedule.scheduleJob('5 10-14 * * 0-4', runHourlyStockJob),
        schedule.scheduleJob('35 15 * * 0-4', runEndOfDayJobs),
        schedule.scheduleJob('50 15 * * 0-4', runWeeklyJob),
        schedule.scheduleJob('55 15 * * 0-4', runMonthlyJob)
    ].filter(Boolean);

    running = true;
    logger.info('[AiSummaryScheduler] Started AI summary jobs');
}

function stopScheduler() {
    for (const job of jobs) job.cancel();
    jobs = [];
    running = false;
}

function getStatus() {
    const config = getAiSummaryConfig();
    return {
        enabled: config.enabled,
        running,
        provider: config.provider,
        model: config.model,
        stockBatchSize: config.stockBatchSize,
        dailyBudgetUsd: config.dailyBudgetUsd,
        scheduledJobs: jobs.length,
        lastRun,
        lastError
    };
}

module.exports = {
    startScheduler,
    stopScheduler,
    getStatus,
    runHourlyStockJob,
    runEndOfDayJobs,
    runWeeklyJob,
    runMonthlyJob,
    isLastTradingDayOfWeek,
    isLastTradingDayOfMonth
};
