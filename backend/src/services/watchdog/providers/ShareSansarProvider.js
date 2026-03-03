const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../utils/logger');

/**
 * Process a single raw HTML row to extract core metrics
 */
const processRow = ($, tr, resultData) => {
    const text = $(tr).text().replace(/\s+/g, ' ').toLowerCase();

    if (text.includes('total turnover')) {
        const val = parseFloat($(tr).find('td').eq(1).text().replace(/,/g, ''));
        if (!isNaN(val)) resultData.totalTurnover = val;
    }
    if (text.includes('total transaction')) {
        const val = parseInt($(tr).find('td').eq(1).text().replace(/,/g, ''), 10);
        if (!isNaN(val)) resultData.totalTransactions = val;
    }
    if (text.includes('nepse') && $(tr).find('td').length > 1 && resultData.nepseIndex == null && !text.includes('float')) {
        const val = parseFloat($(tr).find('td').eq(1).text().replace(/,/g, ''));
        if (!isNaN(val)) resultData.nepseIndex = val;
    }
};

/**
 * Extract market metrics from raw HTML rows
 */
const extractMetrics = ($, resultData) => {
    $('table tr').each((i, tr) => {
        processRow($, tr, resultData);
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

            if (result.data.totalTurnover == null ||
                result.data.totalTransactions == null ||
                result.data.nepseIndex == null) {
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
