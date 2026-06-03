import axios from 'axios';

/**
 * API Service Layer
 * Handles all backend API communication
 * 
 * Refactored in Phase 7 to eliminate response unwrapping duplication
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';
const TIMEOUT = 10000;

import logger from '../utils/logger';

const isSilentStatus = (error, silentStatuses = []) => {
    const status = error?.response?.status;
    return status && silentStatuses.includes(status);
};

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    timeout: TIMEOUT,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response.data,
    (error) => {
        const silentStatuses = error.config?.silentStatuses || [];
        if (!isSilentStatus(error, silentStatuses)) {
            logger.error('API Error:', error.message);
            if (error.response) {
                logger.error('Response:', error.response.status, error.response.data);
            }
        }
        return Promise.reject(error);
    }
);

// ==================== Response Helpers ====================
// Centralized response unwrapping to eliminate duplication

/**
 * Unwrap API response payload - handles both { data: ... } and direct responses
 * @param {any} response - Raw API response (already unwrapped by interceptor)
 * @returns {any} The unwrapped payload
 */
const unwrapPayload = (response) => {
    if (!response) return null;
    return response.data !== undefined ? response.data : response;
};

/**
 * Safe API call wrapper - handles errors and returns default value
 * @param {Function} apiCall - Async function that makes the API call
 * @param {any} defaultValue - Value to return on error
 * @param {string} errorMsg - Error message for logging
 * @returns {Promise<any>} API result or default value
 */
const safeApiCall = async (apiCall, defaultValue, errorMsg, options = {}) => {
    try {
        return await apiCall();
    } catch (error) {
        if (!isSilentStatus(error, options.silentStatuses || [])) {
            logger.error(errorMsg, error);
        }
        return defaultValue;
    }
};

/**
 * Fetch and unwrap a simple array/object endpoint
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @param {any} defaultValue - Default on error
 * @param {string} errorMsg - Error message
 * @returns {Promise<any>}
 */
const buildRequestOptions = (params, options) => ({
    params,
    silentStatuses: options.silentStatuses,
    skipAuthRefresh: options.skipAuthRefresh
});

const fetchSimple = async ({
    endpoint,
    params = {},
    defaultValue = [],
    errorMsg = 'API error',
    options = {}
}) => {
    return safeApiCall(async () => {
        const response = await api.get(endpoint, buildRequestOptions(params, options));
        if (!response) return defaultValue;
        const payload = unwrapPayload(response);
        return payload.data || payload || defaultValue;
    }, defaultValue, errorMsg, options);
};

/**
 * Resolve list payload into standardized array structure
 * @param {Object} payload - API Response payload
 * @param {string} listKey - specific key to look for
 * @returns {Array} Extracted items
 */
const resolveListPayload = (payload, listKey) => {
    if (listKey) return payload[listKey];
    return payload.data || payload.stocks || payload.ipos || [];
};

/**
 * Fetch and unwrap a list endpoint with count/total
 * Standardizes response format for paginated/list data
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @param {string} errorMsg - Error message
 * @param {string} listKey - specific key to look for in payload (optional)
 * @returns {Promise<Object>} { data: [], total: 0, ...otherProps }
 */
const fetchList = async ({
    endpoint,
    params = {},
    errorMsg = 'API error',
    listKey = null,
    options = {}
}) => {
    return safeApiCall(async () => {
        const payload = await api.get(endpoint, buildRequestOptions(params, options));
        if (!payload) return { data: [], total: 0 };

        // Auto-detect list array if not specified
        const data = resolveListPayload(payload, listKey);
        const total = payload.count || payload.total || 0;

        // Return structured list response, preserving other payload props (pagination, statistics)
        return { ...payload, data: data || [], total };
    }, { data: [], total: 0 }, errorMsg, options);
};

// ==================== Stock APIs ====================

/**
 * Get all stocks with pagination
 */
export const getStocks = async (page = 1, limit = 50, sortBy = 'symbol', sortOrder = 'asc') => {
    try {
        const skip = (page - 1) * limit;
        const result = await fetchList({
            endpoint: '/stocks',
            params: { skip, limit, sortBy, sortOrder },
            errorMsg: 'Failed to fetch stocks'
        });
        // Map standardized 'data' back to 'stocks' for component compatibility
        return { stocks: result.data, total: result.total, pagination: result.pagination };
    } catch (error) {
        return { stocks: [], total: 0 };
    }
};

/**
 * Get stock by symbol
 */
export const getStockBySymbol = async (symbol) => {
    return fetchSimple({
        endpoint: `/stocks/${symbol}`,
        defaultValue: null,
        errorMsg: `Failed to fetch stock ${symbol}`
    });
};

/**
 * Get stock price history with technical indicators
 */
export const getStockHistory = async (symbol, days = 180) => {
    return fetchSimple({
        endpoint: `/stocks/${symbol}/history`,
        params: { days },
        defaultValue: [],
        errorMsg: `Failed to fetch history for ${symbol}`
    });
};

/**
 * Search stocks by symbol or company name
 */
export const searchStocks = async (query) => {
    if (!query || query.length < 1) return { stocks: [] };
    const result = await fetchList({
        endpoint: '/stocks/search',
        params: { q: query },
        errorMsg: 'Failed to search stocks'
    });
    return { stocks: result.data, count: result.total };
};

/**
 * Get stocks by sector
 */
export const getStocksBySector = async (sector) => {
    const result = await fetchList({
        endpoint: `/stocks/sector/${encodeURIComponent(sector)}`,
        errorMsg: `Failed to fetch stocks for sector ${sector}`
    });
    return { stocks: result.data, count: result.total };
};

/**
 * Get top gainers
 */
export const getTopGainers = async (limit = 10) => {
    return fetchSimple({
        endpoint: '/stocks/top-gainers',
        params: { limit },
        defaultValue: [],
        errorMsg: 'Failed to fetch top gainers'
    });
};

/**
 * Get top losers
 */
export const getTopLosers = async (limit = 10) => {
    return fetchSimple({
        endpoint: '/stocks/top-losers',
        params: { limit },
        defaultValue: [],
        errorMsg: 'Failed to fetch top losers'
    });
};

/**
 * Get top traded stocks
 */
export const getTopTraded = async (limit = 10) => {
    return fetchSimple({
        endpoint: '/stocks/top-traded',
        params: { limit },
        defaultValue: [],
        errorMsg: 'Failed to fetch top traded stocks'
    });
};

/**
 * Get stocks with no change
 */
export const getUnchangedStocks = async (limit = 10) => {
    return fetchSimple({
        endpoint: '/stocks/unchanged',
        params: { limit },
        defaultValue: [],
        errorMsg: 'Failed to fetch unchanged stocks'
    });
};

/**
 * Get all sectors
 */
export const getSectors = async () => {
    return fetchSimple({
        endpoint: '/stocks/sectors',
        defaultValue: [],
        errorMsg: 'Failed to fetch sectors'
    });
};

/**
 * Get market depth (Level 2 data) for a stock
 */
export const getStockDepth = async (symbol) => {
    return fetchSimple({
        endpoint: `/stocks/${symbol}/depth`,
        defaultValue: null,
        errorMsg: `Failed to fetch depth for ${symbol}`
    });
};

/**
 * Get computed metrics for a stock
 */
export const getStockMetrics = async (symbol) => {
    return fetchSimple({
        endpoint: `/stocks/${symbol}/metrics`,
        defaultValue: null,
        errorMsg: `Failed to fetch metrics for ${symbol}`
    });
};

/**
 * Get aggregate market metrics
 */
export const getMarketMetrics = async () => {
    return fetchSimple({
        endpoint: '/market-metrics',
        defaultValue: null,
        errorMsg: 'Failed to fetch market metrics'
    });
};

// ==================== IPO APIs ====================

/**
 * Get all IPOs with optional status filter
 */
export const getIPOs = async (status = null) => {
    const params = status ? { status } : {};
    const result = await fetchList({
        endpoint: '/ipos',
        params,
        errorMsg: 'Failed to fetch IPOs'
    });
    return { ipos: result.data, total: result.total, statistics: result.statistics };
};

/**
 * Get active/open IPOs
 */
export const getActiveIPOs = async () => {
    return fetchSimple({
        endpoint: '/ipos/active',
        defaultValue: [],
        errorMsg: 'Failed to fetch active IPOs'
    });
};

/**
 * Get IPO by company name
 */
export const getIPOByCompanyName = async (companyName) => {
    return fetchSimple({
        endpoint: `/ipos/${encodeURIComponent(companyName)}`,
        defaultValue: null,
        errorMsg: `Failed to fetch IPO ${companyName}`
    });
};

/**
 * Get IPOs by status
 */
export const getIPOsByStatus = async (status) => {
    const result = await fetchList({
        endpoint: `/ipos/status/${status}`,
        errorMsg: `Failed to fetch IPOs with status ${status}`
    });
    return { ipos: result.data, count: result.total };
};

// ==================== Market APIs ====================

/**
 * Get market summary
 */
export const getMarketSummary = async () => {
    return fetchSimple({
        endpoint: '/market-summary',
        defaultValue: null,
        errorMsg: 'Failed to fetch market summary'
    });
};

/**
 * Get market history
 */
export const getMarketHistory = async (hours = 24) => {
    return fetchSimple({
        endpoint: '/market-history',
        params: { hours },
        defaultValue: [],
        errorMsg: 'Failed to fetch market history'
    });
};

// ==================== Utility Functions ====================

/**
 * Check if API is available
 */
export const checkAPIHealth = async () => {
    try {
        const response = await api.get('/health');
        return response.success === true;
    } catch (error) {
        return false;
    }
};

// ==================== Watchlist APIs ====================

export const getWatchlists = () => api.get('/watchlists').then(unwrapPayload);
export const createWatchlist = (name) => api.post('/watchlists', { name }).then(unwrapPayload);
export const renameWatchlist = (id, name) => api.put(`/watchlists/${id}`, { name }).then(unwrapPayload);
export const deleteWatchlist = (id) => api.delete(`/watchlists/${id}`);
export const addWatchlistItem = (id, symbol) => api.post(`/watchlists/${id}/items`, { symbol }).then(unwrapPayload);
export const removeWatchlistItem = (id, symbol) => api.delete(`/watchlists/${id}/items/${symbol}`);
export const importWatchlistItems = (id, symbols) => api.post(`/watchlists/${id}/import`, { symbols }).then(unwrapPayload);
export const getSharedWatchlist = (slug) => api.get(`/watchlists/shared/${slug}`).then(unwrapPayload);

// ==================== Portfolio APIs ====================

export const getPortfolios = () => api.get('/portfolios').then(unwrapPayload);
export const createPortfolio = (name) => api.post('/portfolios', { name }).then(unwrapPayload);
export const deletePortfolio = (id) => api.delete(`/portfolios/${id}`);
export const addTrade = (portfolioId, trade) => api.post(`/portfolios/${portfolioId}/trades`, trade).then(unwrapPayload);
export const deleteTrade = (portfolioId, tradeId) => api.delete(`/portfolios/${portfolioId}/trades/${tradeId}`);
export const getPortfolioSummary = (id) => api.get(`/portfolios/${id}/summary`).then(unwrapPayload);

// ==================== Alert APIs ====================

export const getAlerts = () => api.get('/alerts').then(unwrapPayload);
export const createAlert = (alert) => api.post('/alerts', alert).then(unwrapPayload);
export const updateAlert = (id, data) => api.put(`/alerts/${id}`, data).then(unwrapPayload);
export const deleteAlert = (id) => api.delete(`/alerts/${id}`);

// ==================== Watchlist Share ====================

export const shareWatchlist = (id) => api.post(`/watchlists/${id}/share`).then(unwrapPayload);
export const unshareWatchlist = (id) => api.post(`/watchlists/${id}/unshare`).then(unwrapPayload);

export default api;
