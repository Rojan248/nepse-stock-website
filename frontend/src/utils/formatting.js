/**
 * Formatting Utility Functions
 */

/**
 * Format price with Nepali Rupee symbol
 * @param {number} number - Price to format
 * @returns {string} Formatted price
 */
export const formatPrice = (number) => {
    if (number === null || number === undefined) return '₨0.00';
    return `₨${parseFloat(number).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
};

/**
 * Format percentage with sign
 * @param {number} number - Percentage to format
 * @returns {string} Formatted percentage
 */
export const formatPercent = (number) => {
    if (number === null || number === undefined) return '0.00%';
    if (number === 0) return '0.00%';
    const sign = number > 0 ? '+' : '';
    return `${sign}${parseFloat(number).toFixed(2)}%`;
};

/**
 * Format large numbers with commas
 * @param {number} number - Number to format
 * @returns {string} Formatted number
 */
export const formatNumber = (number) => {
    if (number === null || number === undefined) return '0';
    return parseFloat(number).toLocaleString('en-IN');
};

/**
 * Format date to readable string
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date
 */
export const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

/**
 * Format timestamp to time ago string
 * @param {Date|string} isoDate - ISO date string
 * @returns {string} Time ago string
 */
export const formatTimestamp = (isoDate) => {
    if (!isoDate) return 'Unknown';

    const now = new Date();
    const date = new Date(isoDate);
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return formatDate(date);
};

/**
 * Get CSS class for price change
 * @param {number} changePercent - Change percentage
 * @returns {string} CSS class name
 */
export const getChangeClass = (changePercent) => {
    if (changePercent > 0) return 'price-up';
    if (changePercent < 0) return 'price-down';
    return 'price-unchanged';
};

/**
 * Format turnover to readable string
 * @param {number} turnover - Turnover amount
 * @returns {string} Formatted turnover
 */
export const formatTurnover = (turnover) => {
    if (!turnover) return '₨0';

    if (turnover >= 10000000) {
        return `₨${(turnover / 10000000).toFixed(2)} Cr`;
    }
    if (turnover >= 100000) {
        return `₨${(turnover / 100000).toFixed(2)} L`;
    }
    return `₨${formatNumber(turnover)}`;
};
