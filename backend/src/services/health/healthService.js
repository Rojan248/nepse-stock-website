const marketOperations = require('../database/marketOperations');
const stockOperations = require('../database/stockOperations');
const scheduler = require('../scheduler/updateScheduler');
const dataFetcher = require('../dataFetcher');
const logger = require('../utils/logger');
const { getMarketState } = require('../utils/marketTime');
const { prisma } = require('../database/connection');

// Server start time for uptime calculation
const serverStartTime = Date.now();

const FRESHNESS_LIMITS_SECONDS = {
    OPEN: 120,
    PRE_OPEN: 15 * 60,
    CLOSED: 6 * 60 * 60,
    POST_CLOSE: 6 * 60 * 60,
    WEEKEND: 24 * 60 * 60,
    HOLIDAY: 24 * 60 * 60
};

const FETCH_FAILURE_PROBLEM_THRESHOLD = 3;
const isSchedulerExpected = () => process.env.DISABLE_BACKGROUND_JOBS !== 'true';

/** Time units for uptime formatting (largest first) */
const TIME_UNITS = [
    { divisor: 86400, suffix: 'd' },
    { divisor: 3600, suffix: 'h' },
    { divisor: 60, suffix: 'm' },
    { divisor: 1, suffix: 's' }
];

const secondsSince = (date) => {
    if (!date) return null;
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.floor((Date.now() - parsed.getTime()) / 1000);
};

const getServerUptimeSeconds = () =>
    Math.floor((Date.now() - serverStartTime) / 1000);

/** Format uptime seconds to human-readable string (e.g. "2d 5h 30m 12s") */
function formatUptime(seconds) {
    return TIME_UNITS.reduce((parts, { divisor, suffix }) => {
        const value = Math.floor(seconds / divisor);
        seconds %= divisor;
        if (value > 0 || suffix === 's') parts.push(`${value}${suffix}`);
        return parts;
    }, []).join(' ');
}

const getLatestStockSync = async () => {
    const latestStock = await prisma.stock.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
    });
    return latestStock?.updatedAt || null;
};

const collectHealthContext = async () => {
    const updateStatus = scheduler.getUpdateStatus();
    const fetchStatus = dataFetcher.getFetchStatus();
    const uptimeSeconds = getServerUptimeSeconds();
    const marketState = getMarketState();

    const [marketStats, stockCount, latestStockSync] = await Promise.all([
        marketOperations.getMarketStats(),
        stockOperations.getStockCount(),
        getLatestStockSync()
    ]);

    const lastSyncSecondsAgo = secondsSince(latestStockSync);
    const freshnessLimitSeconds = FRESHNESS_LIMITS_SECONDS[marketState] || FRESHNESS_LIMITS_SECONDS.CLOSED;
    const isFresh = lastSyncSecondsAgo !== null && lastSyncSecondsAgo <= freshnessLimitSeconds;

    return {
        updateStatus,
        fetchStatus,
        uptimeSeconds,
        marketState,
        isSchedulerExpected: isSchedulerExpected(),
        marketStats,
        stockCount,
        latestStockSync,
        lastSyncSecondsAgo,
        freshnessLimitSeconds,
        isFresh
    };
};

const hasFetchFailureProblem = (fetchStatus, isFresh) =>
    fetchStatus.consecutiveFailures >= FETCH_FAILURE_PROBLEM_THRESHOLD && !isFresh;

const hasRecentFetchWarning = (fetchStatus, isFresh) =>
    fetchStatus.consecutiveFailures > 0
    && (fetchStatus.consecutiveFailures < FETCH_FAILURE_PROBLEM_THRESHOLD || isFresh);

const HEALTH_PROBLEM_RULES = [
    { applies: ({ updateStatus, isSchedulerExpected }) => isSchedulerExpected && !updateStatus.isRunning, message: () => 'scheduler is not running' },
    { applies: ({ stockCount }) => stockCount <= 100, message: ({ stockCount }) => `stock count too low (${stockCount})` },
    { applies: ({ marketStats }) => !marketStats.hasData, message: () => 'market summary data is missing' },
    { applies: ({ updateStatus }) => updateStatus.circuitBreaker?.isOpen, message: () => 'circuit breaker is open' },
    {
        applies: ({ fetchStatus, isFresh }) => hasFetchFailureProblem(fetchStatus, isFresh),
        message: ({ fetchStatus }) => `${fetchStatus.consecutiveFailures} consecutive fetch failures`
    },
    {
        applies: ({ updateStatus, isFresh }) => updateStatus.isMarketOpen && !isFresh,
        message: ({ lastSyncSecondsAgo }) => `market data stale during open market (${lastSyncSecondsAgo ?? 'unknown'}s old)`
    },
];

const buildHealthProblems = (context) => HEALTH_PROBLEM_RULES
    .filter(rule => rule.applies(context))
    .map(rule => rule.message(context));

const buildHealthWarnings = ({ updateStatus, fetchStatus, marketState, isFresh, lastSyncSecondsAgo, isSchedulerExpected }) => {
    const warnings = [];

    if (!isSchedulerExpected && !updateStatus.isRunning) {
        warnings.push('background jobs are disabled by configuration');
    }
    if (hasRecentFetchWarning(fetchStatus, isFresh)) {
        warnings.push(`${fetchStatus.consecutiveFailures} recent fetch failure`);
    }
    if (!updateStatus.isMarketOpen && !isFresh) {
        warnings.push(`stored market data is older than preferred for ${marketState} (${lastSyncSecondsAgo ?? 'unknown'}s)`);
    }
    if (fetchStatus.rateLimitEvents > 0) {
        warnings.push(`${fetchStatus.rateLimitEvents} rate-limit-like event(s) observed`);
    }

    return warnings;
};

const buildFreshnessStatus = ({ latestStockSync, lastSyncSecondsAgo, freshnessLimitSeconds, isFresh }) => ({
    lastStockSync: latestStockSync ? latestStockSync.toISOString() : null,
    lastSyncSecondsAgo,
    freshnessLimitSeconds,
    isFresh
});

const evaluateHealth = async () => {
    const context = await collectHealthContext();
    const problems = buildHealthProblems(context);
    const warnings = buildHealthWarnings(context);
    const status = problems.length > 0 ? 'degraded' : 'healthy';

    return {
        status,
        problems,
        warnings,
        updateStatus: context.updateStatus,
        fetchStatus: context.fetchStatus,
        uptimeSeconds: context.uptimeSeconds,
        marketState: context.marketState,
        marketStats: context.marketStats,
        stockCount: context.stockCount,
        freshness: buildFreshnessStatus(context)
    };
};

/** Get the most recent stock sync timestamp without full health evaluation */
const getLastSyncSecondsAgo = async () => {
    let lastSyncSecondsAgo = -1;
    try {
        const latestStock = await prisma.stock.findFirst({ orderBy: { updatedAt: 'desc' } });
        if (latestStock?.updatedAt) {
            lastSyncSecondsAgo = Math.floor((Date.now() - latestStock.updatedAt.getTime()) / 1000);
        }
    } catch (e) {
        logger.error(`Failed to get latest stock timestamp: ${e.message}`);
    }
    return lastSyncSecondsAgo;
};

module.exports = {
    evaluateHealth,
    getServerUptimeSeconds,
    getLastSyncSecondsAgo,
    formatUptime
};
