const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const logger = require('./utils/logger');

/**
 * Analytics Service
 * Tracks stock views and searches to calculate trending stocks
 * Uses decay mechanism to prioritize recent activity
 */

class AnalyticsService {
    constructor() {
        this.scores = new Map(); // symbol -> { views: number, searches: number, score: number }
        this.dataPath = path.join(__dirname, '..', 'data', 'analytics.json');
        this.saveInterval = null;
        this.decayInterval = null;
        this.isDirty = false;
    }

    /**
     * Initialize the analytics service
     * Load existing data and start background tasks
     */
    async initialize() {
        await this.loadData();
        this.startPeriodicSave();
        this.startDecayScheduler();
        logger.info('[Analytics] Service initialized');
    }

    /**
     * Load analytics data from file
     */
    async loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const data = await fsPromises.readFile(this.dataPath, 'utf8');
                const parsed = JSON.parse(data);

                // Convert array back to Map
                if (Array.isArray(parsed)) {
                    this.scores = new Map(parsed);
                    logger.info(`[Analytics] Loaded ${this.scores.size} stock scores from file`);
                }
            } else {
                logger.info('[Analytics] No existing data file, starting fresh');
            }
        } catch (error) {
            logger.error(`[Analytics] Failed to load data: ${error.message}`);
        }
    }

    /**
     * Save analytics data to file (async, non-blocking)
     */
    async saveData() {
        if (!this.isDirty) return;

        try {
            // Convert Map to array for JSON serialization
            const data = Array.from(this.scores.entries());
            const json = JSON.stringify(data, null, 2);

            // Atomic write
            const tempPath = `${this.dataPath}.tmp`;
            await fsPromises.writeFile(tempPath, json);
            await fsPromises.rename(tempPath, this.dataPath);

            this.isDirty = false;
            logger.debug(`[Analytics] Saved ${this.scores.size} stock scores`);
        } catch (error) {
            logger.error(`[Analytics] Failed to save data: ${error.message}`);
        }
    }

    /**
     * Start periodic save (every 5 minutes)
     */
    startPeriodicSave() {
        this.saveInterval = setInterval(() => {
            this.saveData();
        }, 5 * 60 * 1000); // 5 minutes
    }

    /**
     * Start decay scheduler (every hour)
     */
    startDecayScheduler() {
        this.decayInterval = setInterval(() => {
            this.applyDecay();
        }, 60 * 60 * 1000); // 1 hour
    }

    /**
     * Apply decay to all scores (multiply by 0.9)
     * This ensures recent activity is weighted higher
     */
    applyDecay() {
        let decayedCount = 0;

        for (const [symbol, data] of this.scores.entries()) {
            data.views = Math.floor(data.views * 0.9);
            data.searches = Math.floor(data.searches * 0.9);
            data.score = this.calculateScore(data.views, data.searches);

            // Remove entries with very low scores to prevent memory bloat
            if (data.score < 1) {
                this.scores.delete(symbol);
            } else {
                decayedCount++;
            }
        }

        this.isDirty = true;
        logger.info(`[Analytics] Applied decay to ${decayedCount} stocks`);
    }

    /**
     * Calculate score: views + (searches * 2)
     */
    calculateScore(views, searches) {
        return views + (searches * 2);
    }

    /**
     * Record a stock view
     */
    recordView(symbol) {
        if (!symbol) return;

        const upperSymbol = symbol.toUpperCase();
        const current = this.scores.get(upperSymbol) || { views: 0, searches: 0, score: 0 };

        current.views++;
        current.score = this.calculateScore(current.views, current.searches);

        this.scores.set(upperSymbol, current);
        this.isDirty = true;

        logger.debug(`[Analytics] View recorded: ${upperSymbol} (score: ${current.score})`);
    }

    /**
     * Record a stock search
     */
    recordSearch(query) {
        if (!query) return;

        const upperQuery = query.toUpperCase();
        const current = this.scores.get(upperQuery) || { views: 0, searches: 0, score: 0 };

        current.searches++;
        current.score = this.calculateScore(current.views, current.searches);

        this.scores.set(upperQuery, current);
        this.isDirty = true;

        logger.debug(`[Analytics] Search recorded: ${upperQuery} (score: ${current.score})`);
    }

    /**
     * Get top trending stocks
     * @param {number} limit - Number of stocks to return
     * @returns {Array} Array of { symbol, views, searches, score }
     */
    getTrending(limit = 6) {
        const sorted = Array.from(this.scores.entries())
            .map(([symbol, data]) => ({
                symbol,
                views: data.views,
                searches: data.searches,
                score: data.score
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return sorted;
    }

    /**
     * Shutdown gracefully
     */
    async shutdown() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        if (this.decayInterval) {
            clearInterval(this.decayInterval);
        }

        // Final save
        await this.saveData();
        logger.info('[Analytics] Service shutdown complete');
    }
}

// Create singleton instance
const analyticsService = new AnalyticsService();

module.exports = analyticsService;
