/**
 * Library Fetcher Configuration
 * Centralized configuration for NEPSE library-based data fetching
 */

// Request configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const CONCURRENCY_LIMIT = 5;
const TIMEOUT = 8000;

// Sector ID mapping from NEPSE API
const SECTOR_IDS = {
    // 58: 'NEPSE Index', // Removed to prevent it being used as a stock sector
    57: 'Sensitive Index',
    51: 'Commercial Banks',
    52: 'Hotels And Tourism',
    53: 'Others',
    54: 'Hydro Power',
    55: 'Development Banks',
    56: 'Manufacturing And Processing',
    59: 'Non Life Insurance',
    60: 'Finance',
    61: 'Trading',
    64: 'Microfinance',
    65: 'Life Insurance',
    66: 'Mutual Fund',
    67: 'Investment'
};

// All sector IDs to fetch (58 = NEPSE Index contains all stocks)
const ALL_SECTORS = [58];

// Index IDs for market summary
const INDEX_IDS = {
    NEPSE: 58,
    SENSITIVE: 57,
    FLOAT: 62,
    SENSITIVE_FLOAT: 63,
    BANKING: 51,
    HOTELS: 52,
    HYDROPOWER: 54,
    DEVELOPMENT_BANKS: 55,
    MANUFACTURING: 56,
    NON_LIFE_INSURANCE: 59,
    FINANCE: 60,
    TRADING: 61,
    MICROFINANCE: 64,
    LIFE_INSURANCE: 65,
    MUTUAL_FUND: 66,
    INVESTMENT: 67
};

module.exports = {
    MAX_RETRIES,
    RETRY_DELAY,
    CONCURRENCY_LIMIT,
    TIMEOUT,
    SECTOR_IDS,
    ALL_SECTORS,
    INDEX_IDS
};
