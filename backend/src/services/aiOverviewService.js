/**
 * AI Overview Service
 * Generates AI-powered stock narratives using Google Gemini API
 * 
 * Rules:
 * - Never hardcode API keys
 * - Handle all Gemini errors gracefully
 * - 500ms delay between AI calls
 * - 30-minute cooldown per symbol
 * - Fallback to secondary model on failure
 */

const { prisma } = require('./database/connection');
const logger = require('./utils/logger');
const metricsOrchestrator = require('./metrics/metricsOrchestrator');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DELAY_BETWEEN_CALLS = 500; // 500ms between API calls

/**
 * Get Gemini configuration from environment
 */
function getConfig() {
    return {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        fallbackModel: process.env.GEMINI_MODEL_FALLBACK || 'gemini-2.0-flash',
        cooldownMinutes: parseInt(process.env.AI_OVERVIEW_COOLDOWN_MINUTES) || 30
    };
}

/**
 * Build a fact sheet from stock data and metrics for the AI prompt
 * @param {Object} stock - Current stock data
 * @param {Object} metrics - Computed metrics
 * @returns {Object} factSheet
 */
function buildFactSheet(stock, metrics) {
    return {
        symbol: stock.symbol,
        companyName: stock.companyName,
        sector: stock.sector,
        ltp: stock.lastTradedPrice,
        previousClose: stock.previousClose,
        change: stock.change,
        percentageChange: stock.percentageChange,
        open: stock.openPrice,
        high: stock.highPrice,
        low: stock.lowPrice,
        volume: stock.volume,
        turnover: stock.turnover,
        priceMetrics: metrics?.priceMetrics || null,
        trendMetrics: metrics?.trendMetrics || null,
        momentumMetrics: metrics?.momentumMetrics || null,
        liquidityMetrics: metrics?.liquidityMetrics || null,
        relativeMetrics: metrics?.relativeMetrics || null,
        fundamentals: metrics?.fundamentals || null,
        patterns: metrics?.patterns || null,
        signals: metrics?.signals || []
    };
}

/**
 * Build the Gemini prompt for stock overview
 * @param {Object} factSheet - Stock fact sheet
 * @returns {string} prompt
 */
function buildPrompt(factSheet) {
    const signalsList = (factSheet.signals || [])
        .map(s => `  - ${s.label} (${s.sentiment})`)
        .join('\n');

    return `You are a NEPSE (Nepal Stock Exchange) market analyst. Given the following data for ${factSheet.symbol} (${factSheet.companyName}), write a brief, insightful overview.

STOCK DATA:
- Symbol: ${factSheet.symbol}
- Company: ${factSheet.companyName}
- Sector: ${factSheet.sector || 'N/A'}
- LTP: Rs ${factSheet.ltp || 'N/A'}
- Previous Close: Rs ${factSheet.previousClose || 'N/A'}
- Change: ${factSheet.change || 0} (${factSheet.percentageChange || 0}%)
- Open: Rs ${factSheet.open || 'N/A'} | High: Rs ${factSheet.high || 'N/A'} | Low: Rs ${factSheet.low || 'N/A'}
- Volume: ${factSheet.volume || 0} | Turnover: Rs ${factSheet.turnover || 0}

TECHNICAL METRICS:
- 52W High: ${factSheet.priceMetrics?.high52w || 'N/A'} | 52W Low: ${factSheet.priceMetrics?.low52w || 'N/A'}
- MA20: ${factSheet.trendMetrics?.ma20?.toFixed(2) || 'N/A'} | MA50: ${factSheet.trendMetrics?.ma50?.toFixed(2) || 'N/A'} | MA180: ${factSheet.trendMetrics?.ma180?.toFixed(2) || 'N/A'}
- Trend: ${factSheet.trendMetrics?.trend || 'N/A'}
- RSI(14): ${factSheet.momentumMetrics?.rsi14?.toFixed(1) || 'N/A'} | RSI(7): ${factSheet.momentumMetrics?.rsi7?.toFixed(1) || 'N/A'}
- ROC(10d): ${factSheet.momentumMetrics?.roc10d?.toFixed(2) || 'N/A'}% | ROC(30d): ${factSheet.momentumMetrics?.roc30d?.toFixed(2) || 'N/A'}%
- Volume Ratio: ${factSheet.liquidityMetrics?.volumeRatio?.toFixed(2) || 'N/A'}x | Liquidity Score: ${factSheet.liquidityMetrics?.liquidityScore || 'N/A'}/100
- Sector Rank: ${factSheet.relativeMetrics?.sectorRank || 'N/A'}/${factSheet.relativeMetrics?.sectorTotal || 'N/A'}
- Market Rank: ${factSheet.relativeMetrics?.marketRank || 'N/A'}/${factSheet.relativeMetrics?.marketTotal || 'N/A'}

ACTIVE SIGNALS:
${signalsList || '  (none)'}

${factSheet.patterns?.postBonusAdjustment ? 'NOTE: This stock appears to be in post-bonus/rights adjustment. Do NOT interpret the price drop as bearish.\n' : ''}

INSTRUCTIONS:
1. Write a 2-3 sentence summary of the stock's current situation
2. Provide 3-5 bullet points highlighting key observations
3. Give a brief 1-2 sentence outlook/what to watch
4. Be factual and data-driven. Do NOT give buy/sell recommendations.
5. If post-bonus adjusted, explain that price decline reflects corporate action, not market weakness.

Respond ONLY in valid JSON format:
{
  "summary": "...",
  "bullets": ["...", "...", "..."],
  "outlook": "..."
}`;
}

/**
 * Build prompt for market-level overview
 * @param {Object} marketMetrics - Aggregate market data
 * @param {Object} marketSummary - Latest market summary
 * @returns {string} prompt
 */
function buildMarketPrompt(marketMetrics, marketSummary) {
    const sectorSummary = (marketMetrics?.sectors || [])
        .slice(0, 10)
        .map(s => `  - ${s.name}: avg ${s.avgChange.toFixed(2)}%, ${s.advancing}↑ ${s.declining}↓`)
        .join('\n');

    return `You are a NEPSE (Nepal Stock Exchange) market analyst. Given today's market data, write a brief market overview.

MARKET DATA:
- NEPSE Index: ${marketSummary?.indexValue || 'N/A'}
- Index Change: ${marketSummary?.indexChange || 0} (${marketSummary?.indexChangePercent || 0}%)
- Total Turnover: Rs ${marketSummary?.totalTurnover || 'N/A'}
- Total Volume: ${marketSummary?.totalVolume || 'N/A'}
- Transactions: ${marketSummary?.totalTransactions || 'N/A'}
- Advancing: ${marketMetrics?.advancing || 0} | Declining: ${marketMetrics?.declining || 0} | Unchanged: ${marketMetrics?.unchanged || 0}
- Breadth Ratio: ${((marketMetrics?.breadthRatio || 0) * 100).toFixed(1)}%

SECTOR PERFORMANCE:
${sectorSummary || '  (unavailable)'}

INSTRUCTIONS:
1. Write a 2-3 sentence summary of today's market
2. Provide 3-5 bullet points on key observations
3. Give a 1-2 sentence outlook
4. Be factual. No buy/sell advice.

Respond ONLY in valid JSON format:
{
  "summary": "...",
  "bullets": ["...", "...", "..."],
  "outlook": "..."
}`;
}

/**
 * Call Gemini API
 * @param {string} prompt - The prompt text
 * @param {string} model - Model name
 * @param {string} apiKey - API key
 * @returns {Object} { text, tokenCount, model }
 */
async function callGemini(prompt, model, apiKey) {
    const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

    const body = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            temperature: 0.4,
            topP: 0.8,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json'
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error('Empty response from Gemini');
    }

    const tokenCount = data?.usageMetadata?.totalTokenCount || 0;

    return { text, tokenCount, model };
}

/**
 * Generate AI overview for a single stock
 * @param {string} symbol - Stock symbol
 * @param {string} triggeredBy - "scheduler" | "manual" | "startup"
 * @returns {Object|null} Generated overview or null
 */
async function generateForSymbol(symbol, triggeredBy = 'manual') {
    const config = getConfig();

    if (!config.apiKey) {
        logger.warn('GEMINI_API_KEY not set — skipping AI overview generation');
        return null;
    }

    try {
        // Check cooldown
        const existing = await prisma.aIOverview.findUnique({
            where: { symbol_type: { symbol: symbol.toUpperCase(), type: 'stock' } }
        });

        if (existing && triggeredBy !== 'startup') {
            const cooldownMs = config.cooldownMinutes * 60 * 1000;
            const elapsed = Date.now() - new Date(existing.updatedAt).getTime();
            if (elapsed < cooldownMs) {
                logger.debug(`Skipping AI for ${symbol}: cooldown (${Math.round((cooldownMs - elapsed) / 60000)}min remaining)`);
                return existing;
            }
        }

        // Get stock data
        const stock = await prisma.stock.findUnique({
            where: { symbol: symbol.toUpperCase() }
        });
        if (!stock || !stock.lastTradedPrice) return null;

        // Get metrics
        const metrics = await metricsOrchestrator.getMetrics(symbol);
        const factSheet = buildFactSheet(stock, metrics);
        const prompt = buildPrompt(factSheet);

        // Try primary model, then fallback
        let result;
        try {
            result = await callGemini(prompt, config.model, config.apiKey);
        } catch (primaryErr) {
            logger.warn(`Primary model (${config.model}) failed for ${symbol}: ${primaryErr.message}. Trying fallback...`);
            try {
                result = await callGemini(prompt, config.fallbackModel, config.apiKey);
            } catch (fallbackErr) {
                logger.error(`Fallback model also failed for ${symbol}: ${fallbackErr.message}`);
                return null;
            }
        }

        // Parse the JSON response
        let narrative;
        try {
            narrative = JSON.parse(result.text);
        } catch {
            // Try to extract JSON from the text
            const jsonMatch = result.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                narrative = JSON.parse(jsonMatch[0]);
            } else {
                logger.error(`Failed to parse Gemini response for ${symbol}`);
                return null;
            }
        }

        narrative.generatedAt = new Date().toISOString();

        // Upsert to database
        const overview = await prisma.aIOverview.upsert({
            where: { symbol_type: { symbol: symbol.toUpperCase(), type: 'stock' } },
            update: {
                context: JSON.stringify(factSheet),
                narrative: JSON.stringify(narrative),
                modelVersion: result.model,
                tokenCount: result.tokenCount,
                triggeredBy,
                updatedAt: new Date()
            },
            create: {
                symbol: symbol.toUpperCase(),
                type: 'stock',
                context: JSON.stringify(factSheet),
                narrative: JSON.stringify(narrative),
                modelVersion: result.model,
                tokenCount: result.tokenCount,
                triggeredBy
            }
        });

        logger.info(`AI overview generated for ${symbol} (${result.tokenCount} tokens, model: ${result.model})`);
        return overview;
    } catch (error) {
        logger.error(`AI overview generation failed for ${symbol}: ${error.message}`);
        return null;
    }
}

/**
 * Generate AI overviews for all active stocks
 * @param {string} triggeredBy - "scheduler" | "startup"
 * @returns {Object} { generated, skipped, failed, total }
 */
async function generateAll(triggeredBy = 'scheduler') {
    const config = getConfig();

    if (!config.apiKey) {
        logger.warn('GEMINI_API_KEY not set — skipping AI overview generation');
        return { generated: 0, skipped: 0, failed: 0, total: 0 };
    }

    const startTime = Date.now();
    logger.info(`Starting AI overview generation for all stocks (triggeredBy: ${triggeredBy})...`);

    const allStocks = await prisma.stock.findMany({
        where: { lastTradedPrice: { gt: 0 } },
        select: { symbol: true },
        orderBy: { symbol: 'asc' }
    });

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const stock of allStocks) {
        try {
            const result = await generateForSymbol(stock.symbol, triggeredBy);
            if (result) {
                generated++;
            } else {
                skipped++;
            }
        } catch (error) {
            logger.error(`AI generation error for ${stock.symbol}: ${error.message}`);
            failed++;
        }

        // 500ms delay between calls
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS));
    }

    const duration = Date.now() - startTime;
    logger.info(`AI generation completed: ${generated} generated, ${skipped} skipped, ${failed} failed out of ${allStocks.length} in ${duration}ms`);

    return { generated, skipped, failed, total: allStocks.length, duration };
}

/**
 * Generate market-level AI overview
 * @param {string} triggeredBy - "scheduler" | "startup"
 * @returns {Object|null} Generated market overview or null
 */
async function generateMarketOverview(triggeredBy = 'scheduler') {
    const config = getConfig();

    if (!config.apiKey) {
        logger.warn('GEMINI_API_KEY not set — skipping market overview generation');
        return null;
    }

    try {
        // Check cooldown
        const existing = await prisma.aIOverview.findUnique({
            where: { symbol_type: { symbol: 'MARKET', type: 'market' } }
        });

        if (existing && triggeredBy !== 'startup') {
            const cooldownMs = config.cooldownMinutes * 60 * 1000;
            const elapsed = Date.now() - new Date(existing.updatedAt).getTime();
            if (elapsed < cooldownMs) {
                return existing;
            }
        }

        // Get market data
        const marketMetrics = await metricsOrchestrator.getMarketMetrics();
        const marketSummary = await prisma.marketSummary.findFirst({
            orderBy: { timestamp: 'desc' }
        });

        if (!marketSummary) return null;

        const prompt = buildMarketPrompt(marketMetrics, marketSummary);

        let result;
        try {
            result = await callGemini(prompt, config.model, config.apiKey);
        } catch (primaryErr) {
            logger.warn(`Primary model failed for market overview: ${primaryErr.message}. Trying fallback...`);
            try {
                result = await callGemini(prompt, config.fallbackModel, config.apiKey);
            } catch (fallbackErr) {
                logger.error(`Fallback model also failed for market overview: ${fallbackErr.message}`);
                return null;
            }
        }

        let narrative;
        try {
            narrative = JSON.parse(result.text);
        } catch {
            const jsonMatch = result.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                narrative = JSON.parse(jsonMatch[0]);
            } else {
                logger.error('Failed to parse Gemini market overview response');
                return null;
            }
        }

        narrative.generatedAt = new Date().toISOString();

        const context = { marketMetrics, marketSummary };

        const overview = await prisma.aIOverview.upsert({
            where: { symbol_type: { symbol: 'MARKET', type: 'market' } },
            update: {
                context: JSON.stringify(context),
                narrative: JSON.stringify(narrative),
                modelVersion: result.model,
                tokenCount: result.tokenCount,
                triggeredBy,
                updatedAt: new Date()
            },
            create: {
                symbol: 'MARKET',
                type: 'market',
                context: JSON.stringify(context),
                narrative: JSON.stringify(narrative),
                modelVersion: result.model,
                tokenCount: result.tokenCount,
                triggeredBy
            }
        });

        logger.info(`Market overview generated (${result.tokenCount} tokens, model: ${result.model})`);
        return overview;
    } catch (error) {
        logger.error(`Market overview generation failed: ${error.message}`);
        return null;
    }
}

/**
 * Get stored AI overview for a symbol
 * @param {string} symbol - Stock symbol or 'MARKET'
 * @param {string} type - 'stock' or 'market'
 * @returns {Object|null} Parsed overview
 */
async function getOverview(symbol, type = 'stock') {
    try {
        const overview = await prisma.aIOverview.findUnique({
            where: { symbol_type: { symbol: symbol.toUpperCase(), type } }
        });

        if (!overview) return null;

        return {
            symbol: overview.symbol,
            type: overview.type,
            narrative: safeJsonParse(overview.narrative),
            context: safeJsonParse(overview.context),
            modelVersion: overview.modelVersion,
            tokenCount: overview.tokenCount,
            triggeredBy: overview.triggeredBy,
            generatedAt: overview.updatedAt
        };
    } catch (error) {
        logger.error(`Failed to get overview for ${symbol}: ${error.message}`);
        return null;
    }
}

function safeJsonParse(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
}

module.exports = {
    generateForSymbol,
    generateAll,
    generateMarketOverview,
    getOverview,
    buildFactSheet,
    buildPrompt,
    buildMarketPrompt
};
