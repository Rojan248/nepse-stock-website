const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../utils/logger');

/** Parse cell value as float */
const cellFloat = ($, tr) => parseFloat($(tr).find('td').eq(1).text().replace(/,/g, ''));

/** Parse cell value as int */
const cellInt = ($, tr) => parseInt($(tr).find('td').eq(1).text().replace(/,/g, ''), 10);

const extractTurnover = ($, tr, text, data) => {
    if (!text.includes('total turnover')) return;
    const val = cellFloat($, tr);
    if (!isNaN(val)) data.totalTurnover = val;
};

const extractTransactions = ($, tr, text, data) => {
    if (!text.includes('total transaction')) return;
    const val = cellInt($, tr);
    if (!isNaN(val)) data.totalTransactions = val;
};

const isNepseIndexRow = ($, tr, text, data) => {
    return text.includes('nepse') && !text.includes('float')
        && $(tr).find('td').length > 1 && data.nepseIndex == null;
};

const extractNepseIndex = ($, tr, text, data) => {
    if (!isNepseIndexRow($, tr, text, data)) return;
    const val = cellFloat($, tr);
    if (!isNaN(val)) data.nepseIndex = val;
};

/**
 * Extract market metrics from raw HTML rows
 */
const extractMetrics = ($, resultData) => {
    $('table tr').each((i, tr) => {
        const text = $(tr).text().replace(/\s+/g, ' ').toLowerCase();
        extractTurnover($, tr, text, resultData);
        extractTransactions($, tr, text, resultData);
        extractNepseIndex($, tr, text, resultData);
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

            extractMetrics($, result.data);

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
