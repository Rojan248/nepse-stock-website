const logger = require('../../utils/logger');

class ShareSansarProvider {
    constructor() {
        this.name = 'ShareSansar';
        this.url = 'https://www.sharesansar.com/market-summary';
    }

    async fetchMarketSummary() {
        logger.warn(`[Watchdog] ShareSansarProvider DOM scraping disabled per MVP V1.0 security directives.`);
        return { 
            source: this.name, 
            success: false,
            error: "Scraping Deprecated (WAF restrictions)" 
        };
    }
}

module.exports = new ShareSansarProvider();
