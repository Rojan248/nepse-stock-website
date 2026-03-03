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
};

/**
 * Extract market metrics from raw HTML rows
 */
const extractMetrics = ($, resultData) => {
    $('table tr').each((i, tr) => {
        processRow($, tr, resultData);
    });

    const nepseEl = $('#ctl00_ContentPlaceHolder1_LiveTrading_LiveMarket1_CG1_lblLastPrice_0');
    if (nepseEl.length) {
        const val = parseFloat(nepseEl.text().replace(/,/g, ''));
        if (!isNaN(val)) resultData.nepseIndex = val;
    }
};

class MerolaganiProvider {
    constructor() {
        this.name = 'Merolagani';
        this.url = 'https://merolagani.com/MarketSummary.aspx';
    }

    async fetchMarketSummary() {
        try {
            const { data } = await axios.get(this.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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

            return result;

        } catch (error) {
            logger.error(`[Watchdog] Merolagani fetch failed: ${error.message}`);
            return { source: this.name, error: error.message };
        }
    }
}

module.exports = new MerolaganiProvider();
