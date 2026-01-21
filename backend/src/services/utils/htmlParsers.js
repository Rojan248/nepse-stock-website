/**
 * HTML Parsing Utilities
 * Extract data from HTML content using regex patterns
 */

/**
 * Extract transaction count from HTML content
 * Matches patterns like "Total Transactions: 1,234" or "Total Transactions<td>5,678"
 * @param {string} html - HTML content to parse
 * @returns {number|null} Transaction count or null if not found
 */
const extractTransactionCount = (html) => {
    if (!html) return null;

    const match = html.match(/Total\s+Transactions(?:[^0-9<]*|[^0-9]*<[^>]+>[^0-9]*)+([0-9,]+)/i);
    if (match && match[1]) {
        const count = parseInt(match[1].replace(/,/g, ''), 10);
        return Number.isNaN(count) ? null : count;
    }

    return null;
};

/**
 * Extract numeric value from JSON-like pattern in HTML
 * Matches patterns like 'Transactions': 1234 or "transactions" = "5,678"
 * @param {string} html - HTML content to parse
 * @param {string} fieldName - Field name to search for (case-insensitive)
 * @returns {number|null} Extracted number or null
 */
const extractJsonField = (html, fieldName) => {
    if (!html || !fieldName) return null;

    const pattern = new RegExp(`${fieldName}["']?\\s*[:=]\\s*["']?([0-9,]+)`, 'i');
    const match = html.match(pattern);

    if (match && match[1]) {
        const value = parseInt(match[1].replace(/,/g, ''), 10);
        return Number.isNaN(value) ? null : value;
    }

    return null;
};

/**
 * Extract turnover from HTML
 * @param {string} html - HTML content
 * @returns {number|null} Turnover value or null
 */
const extractTurnover = (html) => {
    if (!html) return null;

    const match = html.match(/Total\s+Turnover[\\s\\S]{0,50}?([0-9,\\.]{5,})/i);
    if (match && match[1]) {
        const value = parseFloat(match[1].replace(/,/g, ''));
        return Number.isNaN(value) ? null : value;
    }

    return null;
};

/**
 * Extract traded volume from HTML
 * @param {string} html - HTML content
 * @returns {number|null} Volume or null
 */
const extractTradedVolume = (html) => {
    if (!html) return null;

    const match = html.match(/Total\s+Traded\s+Shares[\\s\\S]{0,50}?([0-9,]{3,})/i);
    if (match && match[1]) {
        const value = parseInt(match[1].replace(/,/g, ''), 10);
        return Number.isNaN(value) ? null : value;
    }

    return null;
};

module.exports = {
    extractTransactionCount,
    extractJsonField,
    extractTurnover,
    extractTradedVolume
};
