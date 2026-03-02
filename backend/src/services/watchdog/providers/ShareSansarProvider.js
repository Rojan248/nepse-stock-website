const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../utils/logger');

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

            $('table').each((ti, table) => {
                $(table).find('tr').each((ri, tr) => {
                    const text = $(tr).text().replace(/\s+/g, ' ').toLowerCase();

                    if (text.includes('total turnover')) {
                        const val = parseFloat($(tr).find('td').eq(1).text().replace(/,/g, ''));
                        if (!isNaN(val)) result.data.totalTurnover = val;
                    }
                    if (text.includes('total transaction')) {
                        const val = parseInt($(tr).find('td').eq(1).text().replace(/,/g, ''), 10);
                        if (!isNaN(val)) result.data.totalTransactions = val;
                    }
                    if (text.includes('nepse') && $(tr).find('td').length > 1 && result.data.nepseIndex == null && !text.includes('float')) {
                        const val = parseFloat($(tr).find('td').eq(1).text().replace(/,/g, ''));
                        if (!isNaN(val)) result.data.nepseIndex = val;
                    }
                });
            });

            if (result.data.totalTurnover == null || Number.isNaN(result.data.totalTurnover) ||
                result.data.totalTransactions == null || Number.isNaN(result.data.totalTransactions) ||
                result.data.nepseIndex == null || Number.isNaN(result.data.nepseIndex)) {
                result.success = false;
                result.error = "Missing required metrics (turnover, transactions, or index)";
                return result;
            }

            return result;
        } catch (error) {
            logger.error(`[Watchdog] ShareSansar fetch failed: ${error.message}`);
            return { source: this.name, error: error.message };
        }
    }
}

module.exports = new ShareSansarProvider();
