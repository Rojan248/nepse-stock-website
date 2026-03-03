const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../utils/logger');

/** Metric definitions: keyword to match, output key, and parse function */
const METRIC_DEFS = [
    { keyword: 'total turnover', key: 'totalTurnover', parse: (v) => parseFloat(v) },
    { keyword: 'total transaction', key: 'totalTransactions', parse: (v) => parseInt(v, 10) },
];

/** Check if row is a NEPSE index candidate */
const isNepseIndexCandidate = (text, colCount, data) =>
    text.includes('nepse') && !text.includes('float') && colCount > 1 && data.nepseIndex == null;

/** Try to parse a cell value and assign it to resultData if valid */
const tryAssignMetric = (resultData, key, parseFn, cellText) => {
    const val = parseFn(cellText);
    if (!isNaN(val)) resultData[key] = val;
};

/**
 * Extract table-based metrics from HTML rows
 */
const extractTableMetrics = ($, resultData) => {
    $('table tr').each((i, tr) => {
        const text = $(tr).text().replace(/\s+/g, ' ').toLowerCase();
        const cellText = $(tr).find('td').eq(1).text().replace(/,/g, '');
        const matched = METRIC_DEFS.find(def => text.includes(def.keyword));
        if (matched) tryAssignMetric(resultData, matched.key, matched.parse, cellText);
    });
};

/** Extract the NEPSE index value from table rows */
const extractNepseIndex = ($, resultData) => {
    $('table tr').each((i, tr) => {
        const text = $(tr).text().replace(/\s+/g, ' ').toLowerCase();
        if (!isNepseIndexCandidate(text, $(tr).find('td').length, resultData)) return;
        const val = parseFloat($(tr).find('td').eq(1).text().replace(/,/g, ''));
        if (!isNaN(val)) resultData.nepseIndex = val;
    });
};

class ShareSansarProvider {
    constructor() {
        this.name = 'ShareSansar';
        this.url = 'https://www.sharesansar.com/market-summary';
    }

    async fetchMarketSummary() {
        try {
            const { data } = await axios.get(this.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                },
                timeout: 10000
            });

            const $ = cheerio.load(data);
            const result = {
                source: this.name,
                timestamp: new Date(),
                data: {}
            };

            extractTableMetrics($, result.data);
            extractNepseIndex($, result.data);

            const d = result.data;
            const isMissingMetrics = d.totalTurnover == null || d.totalTransactions == null || d.nepseIndex == null;
            if (isMissingMetrics) {
                result.success = false;
                result.error = "Missing required metrics (turnover, transactions, or index)";
                return result;
            }

            result.success = true;
            return result;
        } catch (error) {
            logger.error(`[Watchdog] ShareSansar fetch failed: ${error.message}`);
            return { source: this.name, error: error.message };
        }
    }
}

module.exports = new ShareSansarProvider();
