/**
 * Market Time Utilities
 * Fetches accurate Nepal time from external time servers
 * Calculates offset to correct local system time
 * 
 * Time Synchronization: The backend fetches accurate Asia/Kathmandu time from 
 * WorldTimeAPI or TimeAPI to ensure correct market state detection, with 
 * fallback to system time if the services are unavailable.
 */

const axios = require('axios');
const logger = require('./logger');

// Store the difference between correct UTC time and system time
// offset = CorrectUTC - SystemUTC
let systemClockOffset = 0;
let lastSync = 0;
let cacheTimestamp = 0;
const SYNC_INTERVAL = 5 * 60 * 1000; // Sync every 5 minutes (reduced from 10s to avoid API spam)

// Nepal Standard Time offset: UTC+5:45
const NST_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

// Market hours configuration (Default 11:00 - 15:00)
const MARKET_OPEN_HOUR = parseInt(process.env.MARKET_OPEN_HOUR) || 11;
const MARKET_OPEN_MINUTE = parseInt(process.env.MARKET_OPEN_MINUTE) || 0;
const MARKET_CLOSE_HOUR = parseInt(process.env.MARKET_CLOSE_HOUR) || 15;
const MARKET_CLOSE_MINUTE = parseInt(process.env.MARKET_CLOSE_MINUTE) || 0;

// Track if initial sync has completed
let initialSyncComplete = false;

/**
 * Fetch time from external reliable sources and calculate offset
 * @param {boolean} silent - If true, suppress info logs
 * @returns {boolean} True if sync succeeded
 */
const fetchTimeOffset = async (silent = false) => {
    const sources = [
        {
            name: 'WorldTimeAPI-Kathmandu',
            url: 'http://worldtimeapi.org/api/timezone/Asia/Kathmandu',
            parse: (data) => {
                // WorldTimeAPI returns utc_datetime which is the accurate UTC time
                // We use this to calculate offset from system time
                return new Date(data.utc_datetime).getTime();
            }
        },
        {
            name: 'TimeAPI-Kathmandu',
            url: 'https://timeapi.io/api/Time/current/zone?timeZone=Asia/Kathmandu',
            parse: (data) => {
                // TimeAPI returns dateTime in Nepal time, convert to UTC
                // The dateTime is in format "2024-12-15T11:45:30" (Nepal time)
                const nepalTime = new Date(data.dateTime).getTime();
                // Subtract NST offset to get UTC
                return nepalTime - NST_OFFSET_MS;
            }
        },
        {
            name: 'WorldTimeAPI-UTC',
            url: 'http://worldtimeapi.org/api/timezone/Etc/UTC',
            parse: (data) => new Date(data.utc_datetime).getTime()
        }
    ];

    for (const source of sources) {
        try {
            if (!silent) {
                logger.info(`[TimeSync] Attempting to fetch from ${source.name}...`);
            }
            
            const start = Date.now();
            const response = await axios.get(source.url, { timeout: 5000 });
            const networkLatency = (Date.now() - start) / 2;

            // All sources now return UTC time after parsing
            const serverUtcTime = source.parse(response.data);
            const accurateUtc = serverUtcTime + networkLatency;
            const systemTime = Date.now();
            const newOffset = accurateUtc - systemTime;

            // Sanity Check: If offset is > 1 hour, likely API error or system clock issue
            // This is expected if your system clock is significantly wrong
            if (Math.abs(newOffset) > 60 * 60 * 1000) {
                // Log but still accept if it's a reasonable timezone difference
                if (!silent) {
                    logger.warn(`[TimeSync] Large offset detected: ${Math.round(newOffset/1000)}s. Your system clock may be incorrect.`);
                }
                // Accept offsets up to 24 hours (in case system is set to wrong timezone)
                if (Math.abs(newOffset) > 24 * 60 * 60 * 1000) {
                    logger.warn(`[TimeSync] Offset too extreme (${Math.round(newOffset/1000)}s). Ignoring ${source.name} data.`);
                    continue;
                }
            }

            systemClockOffset = newOffset;
            lastSync = Date.now();
            cacheTimestamp = Date.now();
            initialSyncComplete = true;

            if (!silent) {
                const nepseTime = getNepseTimeComponents();
                logger.info(`[TimeSync] ✓ Synced with ${source.name}. System clock offset: ${Math.round(systemClockOffset / 1000)}s`);
                logger.info(`[TimeSync] Current Nepal Time: ${nepseTime.hour}:${String(nepseTime.minute).padStart(2, '0')}:${String(nepseTime.second).padStart(2, '0')} (Day: ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][nepseTime.day]})`);
            }
            return true;
        } catch (error) {
            if (!silent) {
                logger.warn(`[TimeSync] Failed to fetch from ${source.name}: ${error.message}`);
            }
        }
    }

    if (!silent) {
        logger.error('[TimeSync] All external time sources failed. Using System Time (may be inaccurate).');
    }
    
    // Mark as synced to prevent repeated failures
    initialSyncComplete = true;
    return false;
};

/**
 * Ensure time is synced, with caching to reduce API calls
 */
const ensureTimeSync = async () => {
    const now = Date.now();
    
    // If never synced, do initial sync
    if (!initialSyncComplete) {
        await fetchTimeOffset(false);
        return;
    }
    
    // If cache is still valid (within SYNC_INTERVAL), use cached offset
    if (now - cacheTimestamp < SYNC_INTERVAL) {
        return;
    }
    
    // Time to refresh - do it silently in background
    fetchTimeOffset(true).catch(e => {
        logger.error(`[TimeSync] Background sync failed: ${e.message}`);
    });
};

/**
 * Get current Nepal Standard Time components
 * Applies systemClockOffset + NST Offset
 * @returns {Object} { hour, minute, second, day, date, month, year, timestamp }
 */
const getNepseTimeComponents = () => {
    // Trigger background sync if needed (non-blocking)
    if (Date.now() - cacheTimestamp > SYNC_INTERVAL && initialSyncComplete) {
        fetchTimeOffset(true).catch(() => {});
    }
    
    // 1. Get correct UTC timestamp (system time + offset)
    const correctUtc = Date.now() + systemClockOffset;

    // 2. Add NST Offset to get Nepal time
    const nstMs = correctUtc + NST_OFFSET_MS;

    // 3. Create Date object (Access via getUTCHours to see NST)
    const nstDate = new Date(nstMs);

    return {
        hour: nstDate.getUTCHours(),
        minute: nstDate.getUTCMinutes(),
        second: nstDate.getUTCSeconds(),
        day: nstDate.getUTCDay(), // 0 = Sunday
        date: nstDate.getUTCDate(),
        month: nstDate.getUTCMonth() + 1,
        year: nstDate.getUTCFullYear(),
        timestamp: nstMs
    };
};

/**
 * Get current Nepal Standard Time as a Date object (async)
 * @returns {Promise<Date>} Date with Nepal time
 */
const getNepseNow = async () => {
    // Ensure sync before returning time
    await ensureTimeSync();
    
    const { hour, minute, second } = getNepseTimeComponents();
    const now = new Date();
    now.setHours(hour, minute, second);
    return now;
};

/**
 * Synchronous version - uses cached offset
 * @returns {Date} Date with Nepal time
 */
const getNepseNowSync = () => {
    const { hour, minute, second } = getNepseTimeComponents();
    const now = new Date();
    now.setHours(hour, minute, second);
    return now;
};

/**
 * Get formatted Nepal time string
 * @returns {string} Formatted time string (HH:MM:SS)
 */
const getNepseTimeString = () => {
    const { hour, minute, second } = getNepseTimeComponents();
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
};

/**
 * Initialize time sync on startup
 */
const initTimeSync = async () => {
    logger.info('[TimeSync] Initializing time synchronization...');
    const success = await fetchTimeOffset(false);
    
    if (success) {
        const { hour, minute, day } = getNepseTimeComponents();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        logger.info(`[TimeSync] ✓ Initialized. Nepal Time: ${dayNames[day]}, ${hour}:${String(minute).padStart(2, '0')}`);
    } else {
        logger.warn('[TimeSync] ⚠ Initialized with system time (external sync failed)');
    }
    
    return success;
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
 * Get current market state based on accurate Nepal time
 * @returns {string} Market state
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
 * @returns {boolean} True if market is open
 */
const isMarketActive = () => {
    return getMarketState() === MARKET_STATES.OPEN;
};

/**
 * Get time sync status for debugging/monitoring
 * @returns {Object} Sync status info
 */
const getTimeSyncStatus = () => {
    const nepseTime = getNepseTimeComponents();
    return {
        synced: initialSyncComplete,
        lastSyncAge: lastSync ? `${Math.round((Date.now() - lastSync) / 1000)}s ago` : 'never',
        offsetMs: systemClockOffset,
        offsetSeconds: Math.round(systemClockOffset / 1000),
        nepseTime: `${nepseTime.hour}:${String(nepseTime.minute).padStart(2, '0')}:${String(nepseTime.second).padStart(2, '0')}`,
        nepseDay: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nepseTime.day],
        marketState: getMarketState()
    };
};

module.exports = {
    getNepseNow,
    getNepseNowSync,
    getNepseTimeComponents,
    getNepseTimeString,
    getMarketState,
    isMarketActive,
    initTimeSync,
    getTimeSyncStatus,
    MARKET_STATES
};
