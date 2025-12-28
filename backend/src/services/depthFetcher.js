/**
 * Market Depth & Floorsheet Service
 * Fetches and caches Level 2 market data (Bid/Ask + recent trades)
 */

const logger = require('./utils/logger');

// TTL Cache - 60 seconds
const CACHE_TTL_MS = 60 * 1000;
const depthCache = new Map();

/**
 * Generate mock market depth data for development/weekend testing
 */
function generateMockDepth(symbol) {
    const basePrice = 500 + Math.random() * 1000; // Random base between 500-1500

    // Generate 5 buy orders (below current price)
    const buy = [];
    for (let i = 0; i < 5; i++) {
        buy.push({
            orders: Math.floor(Math.random() * 20) + 1,
            quantity: Math.floor(Math.random() * 5000) + 100,
            rate: Math.round((basePrice - (i + 1) * 2) * 100) / 100
        });
    }

    // Generate 5 sell orders (above current price)
    const sell = [];
    for (let i = 0; i < 5; i++) {
        sell.push({
            rate: Math.round((basePrice + (i + 1) * 2) * 100) / 100,
            quantity: Math.floor(Math.random() * 5000) + 100,
            orders: Math.floor(Math.random() * 20) + 1
        });
    }

    // Generate mock floorsheet (recent trades)
    const floorsheet = [];
    const brokers = ['SHINE', 'GLOBAL', 'KUMARI', 'SIDDHARTHA', 'SUNRISE', 'PRABHU', 'LAXMI', 'NABIL', 'SANIMA', 'MEGA'];

    for (let i = 0; i < 15; i++) {
        const tradePrice = basePrice + (Math.random() * 10 - 5);
        const qty = Math.floor(Math.random() * 500) + 10;

        floorsheet.push({
            transId: 10000000 + Math.floor(Math.random() * 9000000),
            buyerBroker: brokers[Math.floor(Math.random() * brokers.length)],
            sellerBroker: brokers[Math.floor(Math.random() * brokers.length)],
            quantity: qty,
            rate: Math.round(tradePrice * 100) / 100,
            amount: Math.round(qty * tradePrice * 100) / 100
        });
    }

    return {
        marketDepth: { buy, sell },
        floorsheet,
        source: 'mock',
        timestamp: new Date().toISOString()
    };
}

/**
 * Fetch real market depth from NEPSE API
 */
async function fetchRealDepth(symbol) {
    try {
        const { nepseClient, nepseAxios, createHeaders, BASE_URL } = require('nepse-api-helper');

        await nepseClient.initialize();
        const token = await nepseClient.getToken();
        const headers = createHeaders(token);

        // Fetch market depth (top bids/asks)
        // Note: NEPSE API endpoint may vary; adjust as needed
        const depthResponse = await nepseAxios.get(`${BASE_URL}/api/nots/market-depth/${symbol}`, {
            headers,
            timeout: 5000
        });

        // Fetch floorsheet (recent trades)
        const floorResponse = await nepseAxios.get(`${BASE_URL}/api/nots/floorsheet/${symbol}`, {
            headers,
            timeout: 5000
        });

        const depthData = depthResponse.data || {};
        const floorData = floorResponse.data || [];

        // Transform to our format
        const buy = (depthData.buyMarketDepth || []).slice(0, 5).map(d => ({
            orders: d.orderCount || d.orders || 0,
            quantity: d.quantity || d.qty || 0,
            rate: d.rate || d.price || 0
        }));

        const sell = (depthData.sellMarketDepth || []).slice(0, 5).map(d => ({
            rate: d.rate || d.price || 0,
            quantity: d.quantity || d.qty || 0,
            orders: d.orderCount || d.orders || 0
        }));

        const floorsheet = (floorData || []).slice(0, 20).map(t => ({
            transId: t.contractId || t.transactionId || 0,
            buyerBroker: t.buyerMemberId || t.buyerBroker || 'N/A',
            sellerBroker: t.sellerMemberId || t.sellerBroker || 'N/A',
            quantity: t.contractQuantity || t.quantity || 0,
            rate: t.contractRate || t.rate || 0,
            amount: t.contractAmount || t.amount || 0
        }));

        return {
            marketDepth: { buy, sell },
            floorsheet,
            source: 'live',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.warn(`Failed to fetch real depth for ${symbol}: ${error.message}`);
        throw error;
    }
}

/**
 * Get market depth for a symbol (with caching)
 */
async function getDepth(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const now = Date.now();

    // Check cache
    const cached = depthCache.get(upperSymbol);
    if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
        logger.debug(`Depth cache HIT for ${upperSymbol}`);
        return cached.data;
    }

    logger.info(`Depth cache MISS for ${upperSymbol}, fetching...`);

    let data;

    // Use mock data in development mode (weekends)
    if (process.env.NODE_ENV === 'development' || process.env.USE_MOCK_DATA === 'true') {
        logger.info(`Using MOCK depth data for ${upperSymbol}`);
        data = generateMockDepth(upperSymbol);
    } else {
        try {
            data = await fetchRealDepth(upperSymbol);
        } catch (error) {
            // Fallback to mock on error
            logger.warn(`Falling back to mock depth for ${upperSymbol}`);
            data = generateMockDepth(upperSymbol);
            data.source = 'mock-fallback';
        }
    }

    // Save to cache
    depthCache.set(upperSymbol, {
        data,
        fetchedAt: now
    });

    return data;
}

/**
 * Clear depth cache (for testing)
 */
function clearCache() {
    depthCache.clear();
    logger.info('Depth cache cleared');
}

module.exports = {
    getDepth,
    clearCache
};
