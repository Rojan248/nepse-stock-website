/**
 * Market Time Utilities
 * Fetches accurate Nepal time from external time servers
 * Calculates offset to correct local system time
 */

const axios = require('axios');
const logger = require('./logger');

// Store the difference between correct UTC time and system time
// offset = CorrectUTC - SystemUTC
let systemClockOffset = 0;
let lastSync = 0;
const SYNC_INTERVAL = 30 * 60 * 1000; // Sync every 30 minutes

// Nepal Standard Time offset: UTC+5:45
const NST_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

// Market hours configuration (Default 11:00 - 15:00)
const MARKET_OPEN_HOUR = parseInt(process.env.MARKET_OPEN_HOUR) || 11;
const MARKET_OPEN_MINUTE = parseInt(process.env.MARKET_OPEN_MINUTE) || 0;
const MARKET_CLOSE_HOUR = parseInt(process.env.MARKET_CLOSE_HOUR) || 15;
const MARKET_CLOSE_MINUTE = parseInt(process.env.MARKET_CLOSE_MINUTE) || 0;

/**
 * Fetch time from external reliable sources and calculate offset
 */
const fetchTimeOffset = async () => {
    const sources = [
        {
            name: 'WorldTimeAPI',
            url: 'http://worldtimeapi.org/api/timezone/Etc/UTC',
            parse: (data) => new Date(data.utc_datetime).getTime()
        },
        {
            name: 'TimeAPI',
            url: 'https://timeapi.io/api/Time/current/zone?timeZone=UTC',
            parse: (data) => new Date(data.dateTime).getTime()
        }
        // Google removed due to header issues (PST/GMT confusion)
    ];

    for (const source of sources) {
        try {
            logger.info(`[TimeSync] Attempting to fetch from ${source.name}...`);
            const start = Date.now();
            const response = await axios.get(source.url, { timeout: 5000 });
            const networkLatency = (Date.now() - start) / 2;

            const serverMsgTime = source.parse(response.data);
            const accurateUtc = serverMsgTime + networkLatency;
            const systemTime = Date.now();

            systemClockOffset = accurateUtc - systemTime;

            // Sanity Check: If offset is > 1 hour, likely API error or caching issue
            if (Math.abs(systemClockOffset) > 60 * 60 * 1000) {
                logger.warn(`[TimeSync] Offset too large (${systemClockOffset}ms). Ignoring ${source.name} data.`);
                continue;
            }

            lastSync = Date.now();

            logger.info(`[TimeSync] Synced with ${source.name}. Offset: ${systemClockOffset}ms.`);
            logger.info(`[TimeSync] System Time: ${new Date(systemTime).toISOString()}`);
            logger.info(`[TimeSync] Corrected UTC: ${new Date(accurateUtc).toISOString()}`);
            return true;
        } catch (error) {
            logger.warn(`[TimeSync] Failed to fetch from ${source.name}: ${error.message}`);
        }
    }

    logger.error('[TimeSync] All external time sources failed. Using System Time.');
    // If we haven't synced ever, offset remains 0 (System Time)
    return false;
};

/**
 * Get current Nepal Standard Time components
 * Applies systemClockOffset + NST Offset
 * @returns {Object} { hour, minute, second, day }
 */
const getNepseTimeComponents = () => {
    // Check auto-sync
    if (Date.now() - lastSync > SYNC_INTERVAL) {
        fetchTimeOffset().catch(e => logger.error(`[TimeSync] Background sync failed: ${e.message}`));
    }

    // 1. Get correct UTC timestamp
    const correctUtc = Date.now() + systemClockOffset;

    // 2. Add NST Offset
    const nstMs = correctUtc + NST_OFFSET_MS;

    // 3. Create Date object (Access via getUTCHours to see NST)
    const nstDate = new Date(nstMs);

    return {
        hour: nstDate.getUTCHours(),
        minute: nstDate.getUTCMinutes(),
        second: nstDate.getUTCSeconds(),
        day: nstDate.getUTCDay() // 0 = Sunday
    };
};

/**
 * Get current Nepal Standard Time as a Date object
 * The Date object will have UTC components matching Nepal Local Time
 */
const getNepseNow = async () => {
    // Force sync if never synced
    if (lastSync === 0) {
        await fetchTimeOffset();
    }

    const { hour, minute, second } = getNepseTimeComponents();
    const now = new Date();
    // We construct a local date object for compatibility with legacy code calling .getHours()
    // BUT caution: new Date() uses system timezone. 
    // Ideally we return the 'nstDate' from above, but existing code might expect local date.
    // Let's stick to the interface "return Date object where .getHours() is Nepal Hour"
    // The safest way is to use setHours(...) on a local date.
    now.setHours(hour, minute, second);
    return now;
};

/**
 * Synchronous version
 */
const getNepseNowSync = () => {
    const { hour, minute, second } = getNepseTimeComponents();
    const now = new Date();
    now.setHours(hour, minute, second);
    return now;
};

/**
 * Initialize time sync on startup
 */
const initTimeSync = async () => {
    logger.info('[TimeSync] Initializing...');
    await fetchTimeOffset();
    const { hour, minute } = getNepseTimeComponents();
    logger.info(`[TimeSync] Current Nepal Time: ${hour}:${String(minute).padStart(2, '0')}`);
};

/**
 * Market state enum
 */
const MARKET_STATES = {
    OPEN: 'OPEN',
    CLOSED_TODAY: 'CLOSED_TODAY',
    WEEKEND: 'WEEKEND',
    PRE_OPEN: 'PRE_OPEN',
    POST_CLOSE: 'POST_CLOSE'
};

/**
 * Get current market state
 */
const getMarketState = () => {
    const { hour, minute, day } = getNepseTimeComponents();

    // Nepal market is closed on Friday (5) and Saturday (6)
    if (day === 5 || day === 6) {
        return MARKET_STATES.WEEKEND;
    }

    const currentMinutes = hour * 60 + minute;
    const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE;
    const closeMinutes = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE;

    if (currentMinutes < openMinutes) {
        return MARKET_STATES.PRE_OPEN;
    }

    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
        return MARKET_STATES.OPEN;
    }

    return MARKET_STATES.POST_CLOSE;
};

/**
 * Check if market is currently active (open for trading)
 */
const isMarketActive = () => {
    return getMarketState() === MARKET_STATES.OPEN;
};

module.exports = {
    getNepseNow,
    getNepseNowSync,
    getMarketState,
    isMarketActive,
    initTimeSync,
    MARKET_STATES
};
