const axios = require('axios');
const logger = require('../../utils/logger');

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

            // Attempt to parse key metrics using Regex
            // Note: This is fragile and depends on their HTML structure
            
            // Debug: Log start of response
            logger.debug(`[Watchdog] Merolagani response start: ${data.substring(0, 200)}`);

            const result = {
                source: this.name,
                timestamp: new Date(),
                data: {}
            };

            // Total Turnover
            const turnoverMatch = data.match(/Total\s+Turnover[^0-9]*([0-9,]+(\.[0-9]+)?)/i);
            if (turnoverMatch) {
                result.data.totalTurnover = parseFloat(turnoverMatch[1].replace(/,/g, ''));
            }

            // Total Transactions
            const txMatch = data.match(/Total\s+Transactions[^0-9]*([0-9,]+)/i);
            if (txMatch) {
                result.data.totalTransactions = parseInt(txMatch[1].replace(/,/g, ''), 10);
            }

            // NEPSE Index (Harder to find reliably via regex on full page, but let's try)
            // Often appears as "NEPSE Index ... value"
            // Or inside a specific div
            
            return result;

        } catch (error) {
            logger.error(`[Watchdog] Merolagani fetch failed: ${error.message}`);
            return { source: this.name, error: error.message };
        }
    }
}

module.exports = new MerolaganiProvider();
