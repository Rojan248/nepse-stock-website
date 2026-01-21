/**
 * Proxy Fetcher Configuration
 * Centralized configuration for proxy-based NEPSE data fetching
 */

// Strict 4s timeout
const TIMEOUT = 4000;

// Multiple API sources to try
const API_SOURCES = [
    {
        name: 'NepseAPI',
        baseUrl: 'https://nepse-api.herokuapp.com',
        stocksEndpoint: '/api/stocks',
        marketEndpoint: '/api/market'
    },
    {
        name: 'NepseData',
        baseUrl: 'https://nepsedata.com',
        stocksEndpoint: '/api/v1/stocks',
        marketEndpoint: '/api/v1/market'
    },
    {
        name: 'MeroShare',
        baseUrl: 'https://backend.meroshare.cdsc.com.np',
        stocksEndpoint: '/api/v1/stocks',
        marketEndpoint: '/api/v1/market'
    }
];

// Standard headers for different sources
const HEADERS = {
    default: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    nepAlpha: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://nepalstock.com.np/'
    },
    shareSansar: {
        'Accept': 'text/html,application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.sharesansar.com/'
    }
};

// IPO endpoints to try
const IPO_ENDPOINTS = ['/api/ipo', '/ipos', '/api/ipos'];

module.exports = {
    TIMEOUT,
    API_SOURCES,
    HEADERS,
    IPO_ENDPOINTS
};
