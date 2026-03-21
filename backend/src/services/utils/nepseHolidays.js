/**
 * NEPSE Public Holiday Calendar
 *
 * Update this file at the start of each fiscal year (mid-July)
 * with the official NEPSE holiday calendar published by Nepal Stock Exchange.
 *
 * Format: 'YYYY-MM-DD' (Gregorian dates)
 * Source: NEPSE official notices / sebon.gov.np
 *
 * The market is also closed every Friday and Saturday (handled by marketTime.js).
 * This file only lists additional public holidays that fall on Sun-Thu.
 */

const NEPSE_HOLIDAYS = [
    // ── 2026 (BS 2082-83) ────────────────────────────────────────────────────

    // Maghe Sankranti / Makar Sankranti
    '2026-01-15',

    // Prithvi Narayan Shah Jayanti (National Unity Day)
    '2026-01-11',

    // Sonam Losar
    '2026-01-29',

    // Maha Shivaratri
    '2026-02-15',

    // Gyalpo Losar
    '2026-02-17',

    // Fagu Purnima (Holi)
    '2026-03-03',

    // Ghode Jatra
    '2026-03-19',

    // Chaite Dashain
    '2026-03-22',

    // Ram Nawami
    '2026-03-26',

    // Nepali New Year (BS 2083) / Bisket Jatra
    '2026-04-14',

    // International Workers' Day
    '2026-05-01',

    // Buddha Jayanti (Vesak)
    '2026-05-12',

    // Republic Day
    '2026-05-29',

    // Ropain Diwas
    '2026-06-29',

    // Janai Purnima / Raksha Bandhan
    '2026-08-12',

    // Gai Jatra
    '2026-08-13',

    // Krishna Janmashtami
    '2026-08-22',

    // Haritalika Teej
    '2026-08-31',

    // Indra Jatra
    '2026-09-12',

    // Constitution Day
    '2026-09-19',

    // Ghatasthapana (Dashain start)
    '2026-10-08',

    // Fulpati
    '2026-10-13',

    // Maha Ashtami
    '2026-10-14',

    // Maha Nawami
    '2026-10-15',

    // Vijaya Dashami
    '2026-10-16',

    // Ekadashi
    '2026-10-18',

    // Dwadashi (Dashain end)
    '2026-10-19',

    // Kojagrat Purnima
    '2026-10-22',

    // Laxmi Puja (Tihar)
    '2026-11-10',

    // Gobardhan Puja / Mha Puja
    '2026-11-11',

    // Bhai Tika
    '2026-11-12',

    // Chhath Parva
    '2026-11-16',

    // ── Add 2027 dates below when NEPSE publishes the calendar ───────────────
];

// Convert to a Set of date strings for O(1) lookup
const holidaySet = new Set(NEPSE_HOLIDAYS);

/**
 * Check if a given date (YYYY-MM-DD) is a NEPSE holiday
 * @param {string} dateStr - Date in 'YYYY-MM-DD' format
 * @returns {boolean}
 */
function isNepseHoliday(dateStr) {
    return holidaySet.has(dateStr);
}

/**
 * Get the formatted date string for today in Nepal timezone
 * @returns {string} 'YYYY-MM-DD'
 */
function getTodayNepseDate() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kathmandu',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(new Date()); // 'YYYY-MM-DD' format (en-CA locale)
}

module.exports = { isNepseHoliday, getTodayNepseDate, NEPSE_HOLIDAYS };
