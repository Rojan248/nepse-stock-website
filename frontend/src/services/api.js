import axios from 'axios';

/**
 * API Service Layer
 * Handles all backend API communication
 * 
 * Refactored in Phase 7 to eliminate response unwrapping duplication
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';
const TIMEOUT = 10000;

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    timeout: TIMEOUT,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response.data,
    (error) => {
        console.error('API Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.status, error.response.data);
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
const safeApiCall = async (apiCall, defaultValue, errorMsg) => {
    try {
        return await apiCall();
    } catch (error) {
        console.error(errorMsg, error);
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
const fetchSimple = async (endpoint, params = {}, defaultValue = [], errorMsg = 'API error') => {
    return safeApiCall(async () => {
        const response = await api.get(endpoint, { params });
        if (!response) return defaultValue;
        const payload = unwrapPayload(response);
        return payload.data || payload || defaultValue;
    }, defaultValue, errorMsg);
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
const fetchList = async (endpoint, params = {}, errorMsg = 'API error', listKey = null) => {
    return safeApiCall(async () => {
        const payload = await api.get(endpoint, { params });
        if (!payload) return { data: [], total: 0 };

        // Auto-detect list array if not specified
        const data = resolveListPayload(payload, listKey);
        const total = payload.count || payload.total || 0;

        // Return structured list response, preserving other payload props (pagination, statistics)
        return { ...payload, data: data || [], total };
    }, { data: [], total: 0 }, errorMsg);
};

// ==================== Stock APIs ====================

/**
 * Get all stocks with pagination
 */
export const getStocks = async (page = 1, limit = 50, sortBy = 'symbol', sortOrder = 'asc') => {
    try {
        const skip = (page - 1) * limit;
        const result = await fetchList('/stocks', { skip, limit, sortBy, sortOrder }, 'Failed to fetch stocks');
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
    return fetchSimple(`/stocks/${symbol}`, {}, null, `Failed to fetch stock ${symbol}`);
};

/**
 * Search stocks by symbol or company name
 */
export const searchStocks = async (query) => {
    if (!query || query.length < 1) return { stocks: [] };
    const result = await fetchList('/stocks/search', { q: query }, 'Failed to search stocks');
    return { stocks: result.data, count: result.total };
};

/**
 * Get stocks by sector
 */
export const getStocksBySector = async (sector) => {
    const result = await fetchList(`/stocks/sector/${encodeURIComponent(sector)}`, {}, `Failed to fetch stocks for sector ${sector}`);
    return { stocks: result.data, count: result.total };
};

/**
 * Get top gainers
 */
export const getTopGainers = async (limit = 10) => {
    return fetchSimple('/stocks/top-gainers', { limit }, [], 'Failed to fetch top gainers');
};

/**
 * Get top losers
 */
export const getTopLosers = async (limit = 10) => {
    return fetchSimple('/stocks/top-losers', { limit }, [], 'Failed to fetch top losers');
};

/**
 * Get top traded stocks
 */
export const getTopTraded = async (limit = 10) => {
    return fetchSimple('/stocks/top-traded', { limit }, [], 'Failed to fetch top traded stocks');
};

/**
 * Get stocks with no change
 */
export const getUnchangedStocks = async (limit = 10) => {
    return fetchSimple('/stocks/unchanged', { limit }, [], 'Failed to fetch unchanged stocks');
};

/**
 * Get all sectors
 */
export const getSectors = async () => {
    return fetchSimple('/stocks/sectors', {}, [], 'Failed to fetch sectors');
};

/**
 * Get market depth (Level 2 data) for a stock
 */
export const getStockDepth = async (symbol) => {
    return fetchSimple(`/stocks/${symbol}/depth`, {}, null, `Failed to fetch depth for ${symbol}`);
};

// ==================== IPO APIs ====================

/**
 * Get all IPOs with optional status filter
 */
export const getIPOs = async (status = null) => {
    const params = status ? { status } : {};
    const result = await fetchList('/ipos', params, 'Failed to fetch IPOs');
    return { ipos: result.data, total: result.total, statistics: result.statistics };
};

/**
 * Get active/open IPOs
 */
export const getActiveIPOs = async () => {
    return fetchSimple('/ipos/active', {}, [], 'Failed to fetch active IPOs');
};

/**
 * Get IPO by company name
 */
export const getIPOByCompanyName = async (companyName) => {
    return fetchSimple(`/ipos/${encodeURIComponent(companyName)}`, {}, null, `Failed to fetch IPO ${companyName}`);
};

/**
 * Get IPOs by status
 */
export const getIPOsByStatus = async (status) => {
    const result = await fetchList(`/ipos/status/${status}`, {}, `Failed to fetch IPOs with status ${status}`);
    return { ipos: result.data, count: result.total };
};

// ==================== Market APIs ====================

/**
 * Get market summary
 */
export const getMarketSummary = async () => {
    return fetchSimple('/market-summary', {}, null, 'Failed to fetch market summary');
};

/**
 * Get market history
 */
export const getMarketHistory = async (hours = 24) => {
    return fetchSimple('/market-history', { hours }, [], 'Failed to fetch market history');
};

/**
 * Get server health status
 */
export const getServerHealth = async () => {
    return safeApiCall(async () => {
        const response = await api.get('/health');
        return {
            status: response.status,
            server: response.server,
            scheduler: response.scheduler,
            market: response.market,
            data: response.data
        };
    }, null, 'Failed to fetch server health');
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

export default api;
