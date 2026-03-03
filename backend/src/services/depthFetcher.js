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

/** Map a single raw depth entry to standard format */
function transformDepthEntry(d) {
    return {
        orders: d.orderCount || d.orders || 0,
        quantity: d.quantity || d.qty || 0,
        rate: d.rate || d.price || d.orderRate || 0
    };
}

/** Slice and transform a raw depth list */
function sliceAndTransform(list) {
    return (list || []).slice(0, 5).map(transformDepthEntry);
}

/** Detect which response shape NEPSE returned and extract the marketDepth object */
function resolveDepthShape(responseData, symbol) {
    if (responseData?.marketDepth) return responseData.marketDepth;
    if (responseData?.buyMarketDepthList || responseData?.sellMarketDepthList) return responseData;
    logger.warn(`Unrecognized market depth response shape for ${symbol}: ${JSON.stringify(responseData)}`);
    return { buyMarketDepthList: [], sellMarketDepthList: [] };
}

/** Field mapping for floorsheet entries: [outputKey, primaryField, fallbackField, default] */
const FLOOR_FIELD_MAP = [
    ['transId', 'contractId', 'transactionId', 0],
    ['buyerBroker', 'buyerMemberId', 'buyerBroker', 'N/A'],
    ['sellerBroker', 'sellerMemberId', 'sellerBroker', 'N/A'],
    ['quantity', 'contractQuantity', 'quantity', 0],
    ['rate', 'contractRate', 'rate', 0],
    ['amount', 'contractAmount', 'amount', 0],
];

/** Resolve a single field from an object using primary, fallback, or default */
function resolveField(obj, primary, fallback, defaultVal) {
    return obj[primary] || obj[fallback] || defaultVal;
}

/** Map a single raw floorsheet entry to standard format */
function transformFloorEntry(t) {
    const result = {};
    for (const [key, primary, fallback, defaultVal] of FLOOR_FIELD_MAP) {
        result[key] = resolveField(t, primary, fallback, defaultVal);
    }
    return result;
}

async function lookupCompanyId(ctx, symbol) {
    const companiesRes = await ctx.nepseAxios.get(`${ctx.BASE_URL}/api/nots/company/list`, { headers: ctx.headers, timeout: 5000 });
    const company = companiesRes?.data?.find(c => c.symbol === symbol.toUpperCase());
    if (!company) throw new Error(`Company ID not found for symbol ${symbol}`);
    return company.id;
}

async function fetchAndTransformDepth(ctx, companyId, symbol) {
    let marketDepth = { buyMarketDepthList: [], sellMarketDepthList: [] };
    try {
        const res = await ctx.nepseAxios.get(`${ctx.BASE_URL}/api/nots/nepse-data/marketdepth/${companyId}`, { headers: ctx.headers, timeout: 5000 });
        marketDepth = resolveDepthShape(res.data, symbol);
    } catch (e) {
        logger.warn(`Failed to fetch real depth for ${symbol}: ${e.message}`);
    }
    return {
        buy: sliceAndTransform(marketDepth.buyMarketDepthList),
        sell: sliceAndTransform(marketDepth.sellMarketDepthList)
    };
}

/** Extract the floorsheet content array from the raw response */
function resolveFloorContent(rawData) {
    return rawData?.floorsheets?.content || rawData || [];
}

async function fetchAndTransformFloorsheet(ctx, companyId, symbol) {
    let floorData = [];
    try {
        const res = await ctx.nepseAxios.get(`${ctx.BASE_URL}/api/nots/floorsheet?companyId=${companyId}`, { headers: ctx.headers, timeout: 5000 });
        floorData = res.data || [];
    } catch (e) {
        logger.debug(`Floorsheet endpoint unavailable for ${symbol}`);
    }
    return resolveFloorContent(floorData).slice(0, 20).map(transformFloorEntry);
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
        const ctx = { nepseAxios, headers, BASE_URL };

        // 1. Fetch Company List to map symbol to company ID
        const companyId = await lookupCompanyId(ctx, symbol);

        // 2. Fetch Market Depth
        const { buy, sell } = await fetchAndTransformDepth(ctx, companyId, symbol);

        // 3. Fetch Floorsheet
        const floorsheet = await fetchAndTransformFloorsheet(ctx, companyId, symbol);

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
 * Validates if the fetched market data is completely empty.
 */
function isEmptyMarketData(data) {
    return !data.marketDepth.buy.length && !data.marketDepth.sell.length && !data.floorsheet.length;
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

    // User explicitly requested real data. Attempt to fetch real data first even in development.
    try {
        data = await fetchRealDepth(upperSymbol);

        // If the arrays are empty, the market is closed or NEPSE is not processing depth right now.
        // We will return empty arrays to accurately reflect real data status.
        if (isEmptyMarketData(data)) {
            logger.info(`Real depth data for ${upperSymbol} returned empty (market closed).`);
            data.source = 'live-empty';
        }
    } catch (error) {
        // Fallback to empty on hard error (e.g. NEPSE offline)
        logger.warn(`API Error. Falling back to empty object for ${upperSymbol}`);
        data = { marketDepth: { buy: [], sell: [] }, floorsheet: [], source: 'error-fallback', timestamp: new Date().toISOString() };
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
