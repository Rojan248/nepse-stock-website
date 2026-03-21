/**
 * AI Overview Service
 * Generates AI-powered stock narratives using Google Gemini API
 *
 * Autonomous operation:
 * - Processes stocks in chunks to respect API rate limits
 * - Detects 429 rate limits and backs off automatically
 * - Tracks daily quota exhaustion and stops until reset
 * - Sanitizes all output to remove jargon and format numbers
 * - Triggered by scheduler after market close and on startup
 */

const { prisma } = require('./database/connection');
const logger = require('./utils/logger');
const metricsOrchestrator = require('./metrics/metricsOrchestrator');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Rate limit config
const DELAY_BETWEEN_CALLS = 2000;  // 2s between API calls (safe for free tier)
const CHUNK_SIZE = 10;             // Process 10 stocks per chunk
const CHUNK_DELAY = 15000;         // 15s pause between chunks
const MAX_CONSECUTIVE_429 = 3;     // 3 consecutive 429s = daily quota hit
const BACKOFF_ON_429 = 65000;      // 65s backoff on single 429

// ── API key rotation ─────────────────────────────────────────────────────────
// Supports multiple Gemini API keys (comma-separated in GEMINI_API_KEYS env var).
// When a key gets 429 (quota exhausted), it rotates to the next key.
function loadApiKeys() {
    const multiKeys = process.env.GEMINI_API_KEYS;
    if (multiKeys) {
        return multiKeys.split(',').map(k => k.trim()).filter(Boolean);
    }
    const single = process.env.GEMINI_API_KEY;
    return single ? [single] : [];
}

const apiKeys = loadApiKeys();
let currentKeyIndex = 0;
const exhaustedKeys = new Set(); // track keys that hit daily quota

function getCurrentApiKey() {
    if (apiKeys.length === 0) return null;
    return apiKeys[currentKeyIndex];
}

function rotateApiKey() {
    exhaustedKeys.add(currentKeyIndex);
    // Find next non-exhausted key
    for (let i = 1; i <= apiKeys.length; i++) {
        const nextIndex = (currentKeyIndex + i) % apiKeys.length;
        if (!exhaustedKeys.has(nextIndex)) {
            currentKeyIndex = nextIndex;
            logger.info(`[AI] Rotated to API key ${nextIndex + 1}/${apiKeys.length}`);
            return true;
        }
    }
    logger.warn('[AI] All API keys exhausted');
    return false; // all keys exhausted
}

function resetExhaustedKeys() {
    exhaustedKeys.clear();
    currentKeyIndex = 0;
}

// ── Runtime state ─────────────────────────────────────────────────────────────
let isGenerating = false;
let generationStats = { lastRun: null, generated: 0, failed: 0, skipped: 0, total: 0, quotaExhausted: false };

// ── Jargon sanitizer ──────────────────────────────────────────────────────────
const JARGON_REPLACEMENTS = [
    [/\bbullish\b/gi, 'positive'],
    [/\bbearish\b/gi, 'negative'],
    [/\bresistance\s*(level)?/gi, 'price ceiling'],
    [/\bsupport\s*(level)?/gi, 'price floor'],
    [/\bconsolidation\b/gi, 'sideways movement'],
    [/\bconsolidating\b/gi, 'moving sideways'],
    [/\bvolatility\b/gi, 'price swings'],
    [/\bvolatile\b/gi, 'unpredictable'],
    [/\bmomentum\b/gi, 'movement'],
    [/\bsentiment\b/gi, 'mood'],
    [/\brally\b/gi, 'rise'],
    [/\bcorrection\b/gi, 'price drop'],
    [/\boverbought\b/gi, 'risen a lot'],
    [/\boversold\b/gi, 'fallen a lot'],
    [/\b52[- ]?week\s+high\b/gi, 'highest price in the past year'],
    [/\b52[- ]?week\s+low\b/gi, 'lowest price in the past year'],
    [/\bRSI\b/g, 'momentum score'],
    [/\bMA\s*20\b/gi, 'average price last month'],
    [/\bMA\s*180\b/gi, 'average price last 6 months'],
    [/\bMACD\b/gi, 'trend indicator'],
    [/\bdivergence\b/gi, 'mismatch'],
    [/\bsurge[ds]?\b/gi, (m) => m.replace(/surge/i, 'rise')],
    [/\bRs\.?\s*/g, 'NPR '],
    [/₹\s*/g, 'NPR '],
];

function sanitizeText(text) {
    if (typeof text !== 'string') return text;
    let result = text;
    for (const [pattern, replacement] of JARGON_REPLACEMENTS) {
        result = result.replace(pattern, replacement);
    }
    // Format raw large numbers (6+ digits) into lakh/crore
    result = result.replace(/(?:NPR\s*)?(\d{6,}(?:\.\d+)?)/g, (match, numStr) => {
        const num = parseFloat(numStr);
        const prefix = match.startsWith('NPR') ? 'NPR ' : '';
        if (num >= 10000000) return `${prefix}${(num / 10000000).toFixed(2)} crore`;
        if (num >= 100000) return `${prefix}${(num / 100000).toFixed(2)} lakh`;
        return match;
    });
    return result;
}

function sanitizeNarrative(narrative) {
    if (!narrative) return narrative;
    return {
        summary: sanitizeText(narrative.summary),
        bullets: Array.isArray(narrative.bullets) ? narrative.bullets.map(b => sanitizeText(b)) : narrative.bullets,
        outlook: sanitizeText(narrative.outlook),
    };
}

// ── Config ────────────────────────────────────────────────────────────────────

function getConfig() {
    return {
        apiKey: getCurrentApiKey(),
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        fallbackModel: process.env.GEMINI_MODEL_FALLBACK || 'gemini-2.0-flash',
        cooldownMinutes: parseInt(process.env.AI_OVERVIEW_COOLDOWN_MINUTES) || 30
    };
}

// ── Fact sheet & prompt builders ──────────────────────────────────────────────

function fmtNPR(val) {
    if (val == null || isNaN(val)) return 'N/A';
    return `NPR ${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtLakh(val) {
    if (val == null || isNaN(val)) return 'N/A';
    const num = Number(val);
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(2)} crore`;
    if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(2)} lakh`;
    return `${sign}${abs.toLocaleString('en-IN')}`;
}

function buildFactSheet(stock, metrics) {
    return {
        symbol: stock.symbol,
        companyName: stock.companyName,
        sector: stock.sector,
        ltp: stock.lastTradedPrice,
        previousClose: stock.previousClose,
        change: stock.change,
        percentageChange: stock.percentageChange,
        volume: stock.volume,
        turnover: stock.turnover,
        priceMetrics: metrics?.priceMetrics || null,
        trendMetrics: metrics?.trendMetrics || null,
        momentumMetrics: metrics?.momentumMetrics || null,
        signals: metrics?.signals || []
    };
}

function buildPrompt(factSheet) {
    let d = `Company: ${factSheet.companyName} (Symbol: ${factSheet.symbol}, Sector: ${factSheet.sector || 'N/A'})`;
    d += `\nCurrent Price: ${fmtNPR(factSheet.ltp)} | Yesterday's Price: ${fmtNPR(factSheet.previousClose)} | Change: ${factSheet.change} (${factSheet.percentageChange}%)`;
    d += `\nShares Traded Today: ${fmtLakh(factSheet.volume)} shares`;
    if (factSheet.priceMetrics?.high52w) d += `\nHighest Price in Past Year: ${fmtNPR(factSheet.priceMetrics.high52w)} | Lowest: ${fmtNPR(factSheet.priceMetrics.low52w)}`;
    if (factSheet.priceMetrics?.yearlyChange) d += `\nReturn Over Past Year: ${factSheet.priceMetrics.yearlyChange.toFixed(1)}%`;
    if (factSheet.trendMetrics?.trend) d += `\nPrice Trend: ${factSheet.trendMetrics.trend}`;
    if (factSheet.trendMetrics?.ma20) d += `\nAverage Price Last Month: ${fmtNPR(factSheet.trendMetrics.ma20)}`;

    return `You are explaining a NEPSE stock to a first-time investor who has never bought a share. Write in simple, plain English — like explaining to a friend.

STRICT RULES — must follow all:
- NEVER use jargon: no "52-week", "RSI", "MA20", "MACD", "bullish", "bearish", "resistance", "support", "consolidation", "overbought", "oversold", "volatility", "momentum", "sentiment", "rally", "correction"
- Say "highest price in the past year" not "52-week high"
- Explain trends plainly: "the price has been slowly rising" or "the price dropped a lot lately"
- Use "NPR" before all prices with commas (e.g. NPR 1,250 not NPR1250) — this is Nepali Rupee
- For share volumes use lakh/crore: say "9.36 lakh shares" not "936,347 shares"
- summary: 2-3 friendly sentences — what the company does, how the price is moving
- bullets: 3-4 simple things a beginner would care about
- outlook: 1-2 plain sentences — stable, improving, or under pressure?
- No buy/sell recommendations

${d}

Respond with ONLY valid JSON — no markdown, no extra text:
{"summary":"...","bullets":["...","...","..."],"outlook":"..."}`;
}

function buildMarketPrompt(marketMetrics, marketSummary) {
    const sectors = (marketMetrics?.sectors || []).slice(0, 8)
        .map(s => `${s.name}: avg ${s.avgChange?.toFixed(2)}% change, ${s.advancing} stocks up, ${s.declining} stocks down`)
        .join('; ');
    const totalStocks = (marketMetrics?.advancing || 0) + (marketMetrics?.declining || 0) + (marketMetrics?.unchanged || 0);

    return `You are explaining today's NEPSE stock market to someone completely new to investing. Write in simple, friendly language.

Today's market data:
- NEPSE Index: ${marketSummary?.indexValue || 'N/A'} (changed by ${marketSummary?.indexChange || 0} points, ${marketSummary?.indexChangePercent || 0}%)
- Total money traded: NPR ${fmtLakh(marketSummary?.totalTurnover)}
- Total shares traded: ${fmtLakh(marketSummary?.totalVolume)} shares
- Total stocks traded: ${totalStocks}
- Stocks that went up: ${marketMetrics?.advancing || 0} | Went down: ${marketMetrics?.declining || 0} | No change: ${marketMetrics?.unchanged || 0}
- Sector breakdown: ${sectors}

STRICT RULES — must follow all:
- NEVER use jargon: no "bullish", "bearish", "resistance", "support", "consolidation", "volatility", "momentum", "sentiment", "rally", "correction", "overbought", "oversold"
- Explain what the index movement means simply (e.g. "the overall market rose slightly today")
- Say "more stocks went up than down" or vice versa
- Mention 1-2 sectors that stood out in simple language
- Always write money amounts with NPR and use lakh/crore (e.g., NPR 62.34 crore, not NPR 623438148)
- summary: 2-3 plain sentences about what happened in the market today
- bullets: 3-4 simple highlights a beginner would understand
- outlook: 1-2 plain sentences about what the current state suggests

Respond with ONLY valid JSON — no markdown, no extra text:
{"summary":"...","bullets":["...","...","..."],"outlook":"..."}`;
}

// ── Gemini API caller ─────────────────────────────────────────────────────────

async function callGemini(prompt, model, apiKey) {
    const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

    const body = {
        contents: [{ parts: [{ text: prompt }] }],
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
        const err = new Error(`Gemini API ${response.status}`);
        err.status = response.status;
        throw err;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');

    return { text, tokenCount: data?.usageMetadata?.totalTokenCount || 0, model };
}

function extractJSON(text) {
    try { return JSON.parse(text); } catch {}
    const m = text.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch {}
    return null;
}

// ── Save overview (with sanitization) ─────────────────────────────────────────

async function saveOverview(symbol, rawNarrative, factSheet, model, tokenCount, type = 'stock', triggeredBy = 'scheduler') {
    const narrative = sanitizeNarrative(rawNarrative);
    narrative.generatedAt = new Date().toISOString();

    return prisma.aIOverview.upsert({
        where: { symbol_type: { symbol: symbol.toUpperCase(), type } },
        update: {
            context: JSON.stringify(factSheet),
            narrative: JSON.stringify(narrative),
            modelVersion: model,
            tokenCount: Math.round(tokenCount),
            triggeredBy,
            updatedAt: new Date()
        },
        create: {
            symbol: symbol.toUpperCase(),
            type,
            context: JSON.stringify(factSheet),
            narrative: JSON.stringify(narrative),
            modelVersion: model,
            tokenCount: Math.round(tokenCount),
            triggeredBy
        }
    });
}

// ── Generate for a single stock ───────────────────────────────────────────────

async function generateForSymbol(symbol, triggeredBy = 'scheduler') {
    const config = getConfig();
    if (!config.apiKey) return null;

    const stock = await prisma.stock.findUnique({ where: { symbol: symbol.toUpperCase() } });
    if (!stock || !stock.lastTradedPrice) return null;

    const metrics = await metricsOrchestrator.getMetrics(symbol);
    const factSheet = buildFactSheet(stock, metrics);
    const prompt = buildPrompt(factSheet);

    // Try primary, then fallback (uses current rotating key)
    let result;
    try {
        result = await callGemini(prompt, config.model, getCurrentApiKey());
    } catch (primaryErr) {
        if (primaryErr.status === 429) throw primaryErr; // let caller handle rate limits
        try {
            result = await callGemini(prompt, config.fallbackModel, getCurrentApiKey());
        } catch (fallbackErr) {
            if (fallbackErr.status === 429) throw fallbackErr;
            return null;
        }
    }

    const parsed = extractJSON(result.text);
    if (!parsed?.summary) return null;

    await saveOverview(symbol, parsed, factSheet, result.model, result.tokenCount, 'stock', triggeredBy);
    return parsed;
}

// ── Autonomous batch generation with rate limit handling ──────────────────────

/**
 * Generate AI overviews for all stocks, processing in chunks.
 * Handles rate limits by backing off/stopping when quota is exhausted.
 * Called by the scheduler after market close.
 */
async function generateAll(triggeredBy = 'scheduler') {
    const config = getConfig();
    if (!config.apiKey) {
        logger.info('[AI] No GEMINI_API_KEY set — skipping AI generation');
        return generationStats;
    }

    if (isGenerating) {
        logger.info('[AI] Generation already in progress — skipping');
        return generationStats;
    }

    isGenerating = true;
    resetExhaustedKeys(); // fresh start — all keys available
    generationStats = { lastRun: new Date(), generated: 0, failed: 0, skipped: 0, total: 0, quotaExhausted: false };

    try {
        // Get stocks that need overviews (stale > 20 hours or missing)
        const staleThreshold = new Date(Date.now() - 20 * 60 * 60 * 1000);

        const allStocks = await prisma.stock.findMany({
            where: { lastTradedPrice: { gt: 0 } },
            select: { symbol: true },
            orderBy: { symbol: 'asc' }
        });

        const existingOverviews = await prisma.aIOverview.findMany({
            where: { type: 'stock' },
            select: { symbol: true, updatedAt: true }
        });

        const overviewMap = new Map(existingOverviews.map(o => [o.symbol, o.updatedAt]));

        // Filter to stocks needing refresh
        const needsRefresh = allStocks.filter(s => {
            const lastUpdated = overviewMap.get(s.symbol);
            return !lastUpdated || lastUpdated < staleThreshold;
        });

        generationStats.total = needsRefresh.length;
        generationStats.skipped = allStocks.length - needsRefresh.length;

        if (needsRefresh.length === 0) {
            logger.info('[AI] All overviews are fresh — nothing to generate');
            return generationStats;
        }

        logger.info(`[AI] Starting generation: ${needsRefresh.length} stocks need refresh (${generationStats.skipped} already fresh)`);

        let consecutive429 = 0;

        // Process in chunks
        for (let i = 0; i < needsRefresh.length; i += CHUNK_SIZE) {
            if (!isGenerating) break; // allow external stop

            const chunk = needsRefresh.slice(i, i + CHUNK_SIZE);
            logger.info(`[AI] Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(needsRefresh.length / CHUNK_SIZE)} (${chunk.length} stocks)`);

            for (const stock of chunk) {
                if (!isGenerating) break;

                try {
                    const result = await generateForSymbol(stock.symbol, triggeredBy);
                    if (result) {
                        generationStats.generated++;
                        consecutive429 = 0;
                        logger.debug(`[AI] ✓ ${stock.symbol}`);
                    } else {
                        generationStats.failed++;
                    }
                } catch (err) {
                    if (err.status === 429) {
                        consecutive429++;
                        logger.warn(`[AI] Rate limited (429) on ${stock.symbol} — consecutive: ${consecutive429}`);

                        if (consecutive429 >= MAX_CONSECUTIVE_429) {
                            // Try rotating to another API key
                            if (rotateApiKey()) {
                                logger.info('[AI] Switched to next API key — resetting 429 counter');
                                consecutive429 = 0;
                                // Retry this stock with new key
                                try {
                                    const retryResult = await generateForSymbol(stock.symbol, triggeredBy);
                                    if (retryResult) {
                                        generationStats.generated++;
                                    } else {
                                        generationStats.failed++;
                                    }
                                } catch (retryErr) {
                                    generationStats.failed++;
                                    if (retryErr.status === 429) consecutive429++;
                                }
                            } else {
                                logger.warn('[AI] All API keys exhausted. Stopping.');
                                generationStats.quotaExhausted = true;
                                isGenerating = false;
                                break;
                            }
                        } else {
                            // Back off and retry with current key
                            logger.info(`[AI] Backing off ${BACKOFF_ON_429 / 1000}s before retry...`);
                            await new Promise(r => setTimeout(r, BACKOFF_ON_429));

                            try {
                                const retryResult = await generateForSymbol(stock.symbol, triggeredBy);
                                if (retryResult) {
                                    generationStats.generated++;
                                    consecutive429 = 0;
                                } else {
                                    generationStats.failed++;
                                }
                            } catch (retryErr) {
                                if (retryErr.status === 429) {
                                    consecutive429++;
                                    if (consecutive429 >= MAX_CONSECUTIVE_429) {
                                        if (rotateApiKey()) {
                                            logger.info('[AI] Switched to next API key after retry failure');
                                            consecutive429 = 0;
                                        } else {
                                            logger.warn('[AI] All API keys exhausted after retry. Stopping.');
                                            generationStats.quotaExhausted = true;
                                            isGenerating = false;
                                            break;
                                        }
                                    }
                                }
                                generationStats.failed++;
                            }
                        }
                    } else {
                        generationStats.failed++;
                        logger.error(`[AI] Error for ${stock.symbol}: ${err.message}`);
                    }
                }

                // delay between calls
                await new Promise(r => setTimeout(r, DELAY_BETWEEN_CALLS));
            }

            // Pause between chunks (unless last chunk or stopped)
            if (isGenerating && i + CHUNK_SIZE < needsRefresh.length) {
                logger.info(`[AI] Chunk done. Pausing ${CHUNK_DELAY / 1000}s before next chunk...`);
                await new Promise(r => setTimeout(r, CHUNK_DELAY));
            }
        }

        logger.info(`[AI] Generation complete: ${generationStats.generated} generated, ${generationStats.failed} failed, ${generationStats.skipped} already fresh${generationStats.quotaExhausted ? ' (quota exhausted)' : ''}`);

    } catch (error) {
        logger.error(`[AI] Generation batch error: ${error.message}`);
    } finally {
        isGenerating = false;
    }

    return generationStats;
}

// ── Generate market overview ──────────────────────────────────────────────────

async function generateMarketOverview(triggeredBy = 'scheduler') {
    const config = getConfig();
    if (!config.apiKey) return null;

    try {
        // Check cooldown (don't regenerate if updated within last 30 min)
        const existing = await prisma.aIOverview.findUnique({
            where: { symbol_type: { symbol: 'MARKET', type: 'market' } }
        });

        if (existing) {
            const cooldownMs = config.cooldownMinutes * 60 * 1000;
            const elapsed = Date.now() - new Date(existing.updatedAt).getTime();
            if (elapsed < cooldownMs) {
                logger.debug('[AI] Market overview still fresh, skipping');
                return existing;
            }
        }

        const marketMetrics = await metricsOrchestrator.getMarketMetrics();
        const marketSummary = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });
        if (!marketSummary) return null;

        const prompt = buildMarketPrompt(marketMetrics, marketSummary);

        let result;
        try {
            result = await callGemini(prompt, config.model, config.apiKey);
        } catch (primaryErr) {
            if (primaryErr.status === 429) {
                // Try rotating key
                if (rotateApiKey()) {
                    try {
                        result = await callGemini(prompt, config.model, getCurrentApiKey());
                    } catch (retryErr) {
                        logger.warn(`[AI] Market overview failed on rotated key: ${retryErr.message}`);
                        return null;
                    }
                } else {
                    logger.warn('[AI] All API keys rate limited on market overview — skipping');
                    return null;
                }
            } else {
                try {
                    result = await callGemini(prompt, config.fallbackModel, config.apiKey);
                } catch (fallbackErr) {
                    logger.error(`[AI] Market overview generation failed: ${fallbackErr.message}`);
                    return null;
                }
            }
        }

        const parsed = extractJSON(result.text);
        if (!parsed?.summary) {
            logger.error('[AI] Failed to parse market overview response');
            return null;
        }

        await saveOverview('MARKET', parsed, { marketMetrics, marketSummary }, result.model, result.tokenCount, 'market', triggeredBy);
        logger.info(`[AI] Market overview generated (${result.tokenCount} tokens, ${result.model})`);
        return parsed;

    } catch (error) {
        logger.error(`[AI] Market overview error: ${error.message}`);
        return null;
    }
}

// ── Read stored overview ──────────────────────────────────────────────────────

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

// ── Status ────────────────────────────────────────────────────────────────────

function getGenerationStatus() {
    return { isGenerating, ...generationStats };
}

function stopGeneration() {
    isGenerating = false;
    logger.info('[AI] Generation stopped by request');
}

module.exports = {
    generateForSymbol,
    generateAll,
    generateMarketOverview,
    getOverview,
    getGenerationStatus,
    stopGeneration,
    buildFactSheet,
    buildPrompt,
    buildMarketPrompt
};
