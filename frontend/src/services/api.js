import axios from 'axios';

/**
 * API Service Layer
 * Handles all backend API communication
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

// ==================== Stock APIs ====================

/**
 * Get all stocks with pagination
 */
export const getStocks = async (page = 1, limit = 50, sortBy = 'symbol', sortOrder = 'asc') => {
    try {
        const skip = (page - 1) * limit;
        const response = await api.get('/stocks', {
            params: { skip, limit, sortBy, sortOrder }
        });

        if (!response) return { stocks: [], total: 0 };

        // The interceptor already unwraps response.data, so 'response' IS the data
        // Check for 'data' array in the response (API returns { success, data, count, pagination })
        return {
            stocks: response.data || [],
            total: response.count || response.total || 0,
            pagination: response.pagination
        };
    } catch (error) {
        console.error('Failed to fetch stocks:', error);
        return { stocks: [], total: 0 };
    }
};

/**
 * Get stock by symbol
 */
export const getStockBySymbol = async (symbol) => {
    try {
        const response = await api.get(`/stocks/${symbol}`);
        if (!response) return null;
        const payload = response.data !== undefined ? response.data : response;
        return payload.data || payload || null;
    } catch (error) {
        console.error(`Failed to fetch stock ${symbol}:`, error);
        return null;
    }
};

/**
 * Search stocks by symbol or company name
 */
export const searchStocks = async (query) => {
    try {
        if (!query || query.length < 1) return { stocks: [] };
        const response = await api.get('/stocks/search', {
            params: { q: query }
        });
        if (!response) return { stocks: [] };
        const payload = response.data !== undefined ? response.data : response;
        return {
            stocks: payload.data || payload.stocks || [],
            count: payload.count || payload.total || 0
        };
    } catch (error) {
        console.error('Failed to search stocks:', error);
        return { stocks: [] };
    }
};

/**
 * Get stocks by sector
 */
export const getStocksBySector = async (sector) => {
    try {
        const response = await api.get(`/stocks/sector/${encodeURIComponent(sector)}`);
        if (!response) return { stocks: [] };
        const payload = response.data !== undefined ? response.data : response;
        return {
            stocks: payload.data || payload.stocks || [],
            count: payload.count || payload.total || 0
        };
    } catch (error) {
        console.error(`Failed to fetch stocks for sector ${sector}:`, error);
        return { stocks: [] };
    }
};

/**
 * Get top gainers
 */
export const getTopGainers = async (limit = 10) => {
    try {
        const response = await api.get('/stocks/top-gainers', {
            params: { limit }
        });
        if (!response) return [];
        const payload = response.data !== undefined ? response.data : response;
        return payload.data || payload || [];
    } catch (error) {
        console.error('Failed to fetch top gainers:', error);
        return [];
    }
};

/**
 * Get top losers
 */
export const getTopLosers = async (limit = 10) => {
    try {
        const response = await api.get('/stocks/top-losers', {
            params: { limit }
        });
        if (!response) return [];
        const payload = response.data !== undefined ? response.data : response;
        return payload.data || payload || [];
    } catch (error) {
        console.error('Failed to fetch top losers:', error);
        return [];
    }
};

/**
 * Get top traded stocks
 */
export const getTopTraded = async (limit = 10) => {
    try {
        const response = await api.get('/stocks/top-traded', {
            params: { limit }
        });
        if (!response) return [];
        const payload = response.data !== undefined ? response.data : response;
        return payload.data || payload || [];
    } catch (error) {
        console.error('Failed to fetch top traded stocks:', error);
        return [];
    }
};

/**
 * Get stocks with no change
 */
export const getUnchangedStocks = async (limit = 10) => {
    try {
        const response = await api.get('/stocks/unchanged', {
            params: { limit }
        });
        if (!response) return [];
        const payload = response.data !== undefined ? response.data : response;
        return payload.data || payload || [];
    } catch (error) {
        console.error('Failed to fetch unchanged stocks:', error);
        return [];
    }
};

/**
 * Get all sectors
 */
export const getSectors = async () => {
    try {
        const response = await api.get('/stocks/sectors');
        if (!response) return [];
        const payload = response.data !== undefined ? response.data : response;
        return payload.data || payload || [];
    } catch (error) {
        console.error('Failed to fetch sectors:', error);
        return [];
    }
};

// ==================== IPO APIs ====================

/**
 * Get all IPOs with optional status filter
 */
export const getIPOs = async (status = null) => {
    try {
        const params = status ? { status } : {};
        const response = await api.get('/ipos', { params });
        if (!response) return { ipos: [], total: 0, statistics: {} };
        const payload = response.data !== undefined ? response.data : response;
        return {
            ipos: payload.data || payload.ipos || [],
            total: payload.count || payload.total || 0,
            statistics: payload.statistics || payload.stats || {}
        };
    } catch (error) {
        console.error('Failed to fetch IPOs:', error);
        return { ipos: [], total: 0, statistics: {} };
    }
};

/**
 * Get active/open IPOs
 */
export const getActiveIPOs = async () => {
    try {
        const response = await api.get('/ipos/active');
        if (!response) return [];
        const payload = response.data !== undefined ? response.data : response;
        return payload.data || payload || [];
    } catch (error) {
        console.error('Failed to fetch active IPOs:', error);
        return [];
    }
};

/**
 * Get IPO by company name
 */
export const getIPOByCompanyName = async (companyName) => {
    try {
        const response = await api.get(`/ipos/${encodeURIComponent(companyName)}`);
        if (!response) return null;
        const payload = response.data !== undefined ? response.data : response;
        return payload.data || payload || null;
    } catch (error) {
        console.error(`Failed to fetch IPO ${companyName}:`, error);
        return null;
    }
};

/**
 * Get IPOs by status
 */
export const getIPOsByStatus = async (status) => {
    try {
        const response = await api.get(`/ipos/status/${status}`);
        if (!response) return { ipos: [] };
        const payload = response.data !== undefined ? response.data : response;
        return {
            ipos: payload.data || payload.ipos || [],
            count: payload.count || payload.total || 0
        };
    } catch (error) {
        console.error(`Failed to fetch IPOs with status ${status}:`, error);
        return { ipos: [] };
    }
};

// ==================== Market APIs ====================

/**
 * Get market summary
 */
export const getMarketSummary = async () => {
    try {
        const response = await api.get('/market-summary');
        if (!response) return null;
        const payload = response.data !== undefined ? response.data : response;
        return payload.data || payload || null;
    } catch (error) {
        console.error('Failed to fetch market summary:', error);
        return null;
    }
};

/**
 * Get market history
 */
export const getMarketHistory = async (hours = 24) => {
    try {
        const response = await api.get('/market-history', {
            params: { hours }
        });
        if (!response) return [];
        const payload = response.data !== undefined ? response.data : response;
        return payload.data || payload || [];
    } catch (error) {
        console.error('Failed to fetch market history:', error);
        return [];
    }
};

/**
 * Get server health status
 */
export const getServerHealth = async () => {
    try {
        const response = await api.get('/health');
        return {
            status: response.status,
            server: response.server,
            scheduler: response.scheduler,
            market: response.market,
            data: response.data
        };
    } catch (error) {
        console.error('Failed to fetch server health:', error);
        return null;
    }
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
