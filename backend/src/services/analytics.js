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
        this.MAX_ENTRIES = 2000; // Hard limit to prevent memory exhaustion (DoS protection)
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
                    // Enforce limit on load in case file was tampered
                    if (this.scores.size > this.MAX_ENTRIES) {
                        logger.warn(`[Analytics] Loaded data exceeds limit (${this.scores.size} > ${this.MAX_ENTRIES}). Pruning...`);
                        this.applyDecay();
                    }
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

        // If over limit, use aggressive decay to shrink size
        const isOverLimit = this.scores.size > this.MAX_ENTRIES;
        const decayFactor = isOverLimit ? 0.7 : 0.9;
        const pruneThreshold = isOverLimit ? 5 : 1; // Drop low scores aggressively if full

        for (const [symbol, data] of this.scores.entries()) {
            data.views = Math.floor(data.views * decayFactor);
            data.searches = Math.floor(data.searches * decayFactor);
            data.score = this.calculateScore(data.views, data.searches);

            // Remove entries with very low scores to prevent memory bloat
            if (data.score < pruneThreshold) {
                this.scores.delete(symbol);
            } else {
                decayedCount++;
            }
        }

        this.isDirty = true;
        logger.info(`[Analytics] Applied decay to ${decayedCount} stocks (Limit: ${isOverLimit ? 'EXCEEDED' : 'OK'})`);
    }

    /**
     * Calculate score: views + (searches * 2)
     */
    calculateScore(views, searches) {
        return views + (searches * 2);
    }

    /**
     * Record a stock interaction (view or search) to prevent duplication
     * @param {string} symbol - Stock symbol
     * @param {string} interactionType - 'views' or 'searches'
     */
    recordInteraction(symbol, interactionType) {
        if (!this.isValidInput(symbol)) return;

        const upperSymbol = symbol.toUpperCase();

        // Prevent map explosion: If full and new key, ignore
        if (!this.scores.has(upperSymbol) && this.scores.size >= this.MAX_ENTRIES) {
            return;
        }

        const current = this.scores.get(upperSymbol) || { views: 0, searches: 0, score: 0 };

        current[interactionType]++;
        current.score = this.calculateScore(current.views, current.searches);

        this.scores.set(upperSymbol, current);
        this.isDirty = true;

        logger.debug(`[Analytics] ${interactionType} recorded: ${upperSymbol} (score: ${current.score})`);
    }

    /**
     * Record a stock view
     */
    recordView(symbol) {
        this.recordInteraction(symbol, 'views');
    }

    /**
     * Record a stock search
     */
    recordSearch(query) {
        this.recordInteraction(query, 'searches');
    }

    /**
     * Validate input to prevent spam/garbage (DoS protection)
     */
    isValidInput(text) {
        if (!text || typeof text !== 'string') return false;
        if (text.length < 2 || text.length > 20) return false; // Stock symbols are usually 3-4 chars
        // Allow only alphanumeric and common separators (dot/dash)
        return /^[a-zA-Z0-9\-\.]+$/.test(text);
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
