const axios = require('axios');
const logger = require('../utils/logger');

const MEROLAGANI_URL = 'https://merolagani.com/MarketSummary.aspx';
const MEROLAGANI_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache'
};

/** Remove commas from a numeric string */
const stripCommas = (s) => s.replace(/,/g, '');

/** Parse an integer from a comma-separated string */
const parseIntClean = (s) => parseInt(stripCommas(s), 10);

/** Parse a float from a comma-separated string */
const parseFloatClean = (s) => parseFloat(stripCommas(s));

/**
 * Data-driven scraping patterns.
 * Each entry: { field, patterns (tried in order), parser }
 * First matching pattern wins for each field.
 */
const SCRAPE_PATTERNS = [
    {
        field: 'totalTransactions',
        patterns: [
            /Total Transactions<\/th>\s*<td[^>]*>([0-9,]+)/i,
            /Total Transactions<\/[^>]+>\s*<[^>]+>([0-9,]+)/i,
            /Total Transactions[\s\S]{0,50}?([0-9,]{3,})/i,
        ],
        parser: parseIntClean,
    },
    {
        field: 'totalTurnover',
        patterns: [/Total Turnover[\s\S]{0,50}?([0-9,.]{5,})/i],
        parser: parseFloatClean,
    },
    {
        field: 'totalVolume',
        patterns: [/Total Traded Shares[\s\S]{0,50}?([0-9,]{3,})/i],
        parser: parseIntClean,
    },
    {
        field: 'nepseIndex',
        patterns: [
            /NEPSE<\/[^>]+>\s*<[^>]+>([0-9,.]+)/i,
            />NEPSE[\s\S]{0,30}?([0-9,]{1,3}(?:,[0-9]{3})*\.?[0-9]*)/i,
        ],
        parser: parseFloatClean,
    },
];

/** Apply the first matching regex pattern from a list, returning the parsed value or null */
function applyFirstMatch(html, patterns, parser) {
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return parser(match[1]);
    }
    return null;
}

/** Extract an HTML sample around the 'Transactions' keyword for debugging */
function extractHtmlSample(html) {
    const txIdx = html.indexOf('Transactions');
    if (txIdx <= 0) return null;
    return html.substring(Math.max(0, txIdx - 50), txIdx + 150);
}

/**
 * Parse market data from Merolagani HTML using data-driven regex patterns.
 * @param {string} html - Raw HTML string
 * @returns {Object} Parsed fields (values are null if not found)
 */
function scrapeFromMerolagani(html) {
    const result = {};
    for (const { field, patterns, parser } of SCRAPE_PATTERNS) {
        result[field] = applyFirstMatch(html, patterns, parser);
    }
    result.htmlSample = extractHtmlSample(html);
    return result;
}

/**
 * Fetch and parse live market data from Merolagani.
 * @returns {Promise<Object>} Parsed live data with source/error fields populated
 */
async function fetchMerolaganiLive() {
    const base = {
        nepseIndex: null, totalTransactions: null, totalTurnover: null, totalVolume: null,
        advanced: null, declined: null, unchanged: null, source: null, error: null, htmlSample: null
    };

    try {
        const resp = await axios.get(MEROLAGANI_URL, {
            timeout: 15000,
            maxRedirects: 0,
            headers: MEROLAGANI_HEADERS
        });
        const html = resp.data || '';
        logger.info(`Merolagani HTML fetched: ${html.length} bytes`);

        const parsed = scrapeFromMerolagani(html);
        Object.assign(base, parsed, { source: 'merolagani' });
    } catch (err) {
        base.error = err.message;
        logger.error(`Scrape failed: ${err.message}`);
    }

    return base;
}

module.exports = {
    scrapeFromMerolagani,
    fetchMerolaganiLive,
    SCRAPE_PATTERNS
};
