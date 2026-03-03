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

/**
 * Extract market metrics from raw HTML rows
 */
const extractMetrics = ($, resultData) => {
    $('table tr').each((i, tr) => {
        const text = $(tr).text().replace(/\s+/g, ' ').toLowerCase();
        extractTurnover($, tr, text, resultData);
        extractTransactions($, tr, text, resultData);
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
