/**
 * Fetch Market Summary Logic
 * Extracted from libraryFetcher.js to reduce file complexity.
 */
const { isMarketActive } = require('../utils/marketTime');
const logger = require('../utils/logger');

const toF = (v) => parseFloat(v) || 0;
const toI = (v) => parseInt(v, 10) || null;

/** Transform a raw bulk index entry to standard shape */
function transformIndexEntry(idx) {
    return {
        id: idx.id,
        name: idx.index,
        value: toF(idx.currentValue),
        change: toF(idx.change),
        changePercent: toF(idx.perChange),
        high: toF(idx.high),
        low: toF(idx.low),
        previousClose: toF(idx.previousClose),
        advance: toI(idx.advance),
        decline: toI(idx.decline),
        unchanged: toI(idx.unchanged)
    };
}

/** Transform a datewise index response entry to standard shape */
function transformDatewiseIndex(idx) {
    return {
        id: idx.indexId,
        name: idx.index,
        value: parseFloat(idx.indexValue) || parseFloat(idx.closeValue) || 0,
        change: toF(idx.change),
        changePercent: toF(idx.perChange),
        high: toF(idx.highValue),
        low: toF(idx.lowValue),
        previousClose: toF(idx.previousClose)
    };
}

/** Resolve first parseable int from a list of field candidates */
const resolveInt = (obj, fields) => {
    for (const f of fields) {
        const v = parseInt(obj[f], 10);
        if (!isNaN(v)) return v;
    }
    return null;
}

/** Extract market breadth (advance/decline/unchanged) from NEPSE main index */
function extractBreadth(idx) {
    return {
        advancedCompanies: resolveInt(idx, ['advance', 'positive', 'up']),
        declinedCompanies: resolveInt(idx, ['decline', 'negative', 'down']),
        unchangedCompanies: resolveInt(idx, ['unchanged', 'neutral', 'noChange'])
    };
}

/** Summary detail label → field name mapping */
const SUMMARY_DETAIL_MAP = [
    ['turnover', 'totalTurnover', parseFloat],
    ['transaction', 'totalTransactions', (v) => Math.round(parseFloat(v) || 0)],
    ['traded shares', 'totalVolume', (v) => Math.round(parseFloat(v) || 0)],
    ['scrips traded', 'totalScripsTraded', (v) => Math.round(parseFloat(v) || 0)],
];

/** Classify a single summary item, returning { field, value } or null */
function classifySummaryItem(detail, rawValue) {
    // Market cap (exclude float market cap)
    if (detail.includes('market capitalization') && !detail.includes('float')) {
        return { field: 'totalMarketCap', value: parseFloat(rawValue) || 0 };
    }
    for (const [keyword, field, parser] of SUMMARY_DETAIL_MAP) {
        if (detail.includes(keyword)) return { field, value: parser(rawValue) };
    }
    return null;
}

/** Parse market summary items from the summary API response */
function parseSummaryItems(data) {
    const result = { totalTurnover: 0, totalTransactions: 0, totalVolume: 0, totalScripsTraded: 0, totalMarketCap: 0 };
    if (!data || !Array.isArray(data)) return result;

    for (const item of data) {
        const classified = classifySummaryItem((item.detail || '').toLowerCase(), item.value);
        if (classified) result[classified.field] = classified.value;
    }
    return result;
}

/** Check if a datewise-indices response has valid data */
function hasIndexData(res) {
    return res.data && Array.isArray(res.data) && res.data.length > 0;
}

const DEFAULT_BREADTH = { advancedCompanies: null, declinedCompanies: null, unchangedCompanies: null };
const ALL_INDEX_IDS = [51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67];
const requestOptions = (deps, headers) => ({
    headers,
    httpsAgent: deps.nepseHttpsAgent,
    maxRedirects: deps.maxRedirects ?? 0
});

/** Process bulk indices response into a map + breadth */
function processBulkIndices(data) {
    const indicesMap = new Map();
    let breadth = { ...DEFAULT_BREADTH };
    if (!Array.isArray(data)) return { indicesMap, breadth };

    for (const idx of data) {
        if (idx.id === 58) breadth = extractBreadth(idx);
        indicesMap.set(idx.id, transformIndexEntry(idx));
    }
    return { indicesMap, breadth };
}

/** Fetch and fill any missing indices via datewise endpoint */
async function fetchMissingIndices(indicesMap, headers, today, deps) {
    const missingIds = ALL_INDEX_IDS.filter(id => !indicesMap.has(id));
    if (missingIds.length === 0) return;

    const responses = await Promise.all(
        missingIds.map(id =>
            deps.nepseAxios.get(
                `${deps.BASE_URL}/api/nots/datewise-indices?indexId=${id}&startDate=${today}&endDate=${today}`,
                requestOptions(deps, headers)
            )
                .catch(() => ({ data: [] }))
        )
    );

    for (const res of responses) {
        if (hasIndexData(res)) {
            const idx = res.data[0];
            indicesMap.set(idx.indexId, transformDatewiseIndex(idx));
        }
    }
}

const fetchMarketSummary = async (token, deps) => {
    try {
        const headers = deps.createHeaders(token);
        const today = new Date().toISOString().split('T')[0];

        const [bulkIndicesRes, summaryResponse] = await Promise.all([
            deps.nepseAxios.get(`${deps.BASE_URL}/api/nots/nepse-index`, requestOptions(deps, headers)).catch(() => ({ data: [] })),
            deps.nepseAxios.get(`${deps.BASE_URL}/api/nots/market-summary`, requestOptions(deps, headers)).catch(() => null)
        ]);

        const { indicesMap, breadth } = processBulkIndices(bulkIndicesRes.data);
        await fetchMissingIndices(indicesMap, headers, today, deps);

        const indices = Array.from(indicesMap.values());
        const nepseIndex = indices.find(idx => idx.id === 58) || indices[0];
        const summary = parseSummaryItems(summaryResponse?.data);

        const isOpen = isMarketActive();
        const state = require('../utils/marketTime').getMarketState();

        return {
            isOpen,
            state,
            indexValue: nepseIndex.value,
            indexChange: nepseIndex.change,
            indexChangePercent: nepseIndex.changePercent,
            indices,
            ...summary,
            activeCompanies: summary.totalScripsTraded,
            ...breadth,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        logger.error(`Error fetching market summary: ${error.message}`);
        return null;
    }
};

module.exports = {
    fetchMarketSummary
};
