const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../utils/logger');

/** Metric definitions: keyword to match, output key, and parse function */
const METRIC_DEFS = [
    { keyword: 'total turnover', key: 'totalTurnover', parse: (v) => parseFloat(v) },
    { keyword: 'total transaction', key: 'totalTransactions', parse: (v) => parseInt(v, 10) },
];

/**
 * Extract market metrics from raw HTML rows
 */
const extractTableMetrics = ($, resultData) => {
    $('table tr').each((i, tr) => {
        const text = $(tr).text().replace(/\s+/g, ' ').toLowerCase();
        const cellText = $(tr).find('td').eq(1).text().replace(/,/g, '');

        for (const def of METRIC_DEFS) {
            if (text.includes(def.keyword)) {
                const val = def.parse(cellText);
                if (!isNaN(val)) resultData[def.key] = val;
            }
        }
    });
};

/** Extract NEPSE index from a known DOM element */
const extractNepseFromDom = ($, resultData) => {
    const nepseEl = $('#ctl00_ContentPlaceHolder1_LiveTrading_LiveMarket1_CG1_lblLastPrice_0');
    if (!nepseEl.length) return;
    const val = parseFloat(nepseEl.text().replace(/,/g, ''));
    if (!isNaN(val)) resultData.nepseIndex = val;
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

            extractTableMetrics($, result.data);
            extractNepseFromDom($, result.data);

            return result;

        } catch (error) {
            logger.error(`[Watchdog] Merolagani fetch failed: ${error.message}`);
            return { source: this.name, error: error.message };
        }
    }
}

module.exports = new MerolaganiProvider();
