/**
 * Smart AI Overview Generator v3 - Robust Parsing + Model Rotation
 * 
 * Fixes from v2:
 * - Better JSON extraction from responses (handles markdown code blocks, etc.)
 * - Batch size 3 (more reliable JSON from models)
 * - maxOutputTokens 4096 (prevents truncation)
 * - Logs raw response on parse failure for debugging
 * - Longer delay between calls (12s) 
 * 
 * Usage: node scripts/batch-ai-generate-v3.js
 */

require('dotenv').config();
const { prisma } = require('../src/services/database/connection');
const metricsOrchestrator = require('../src/services/metrics/metricsOrchestrator');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const BATCH_SIZE = 3;              // Smaller batches = more reliable JSON
const DELAY_BETWEEN_CALLS = 12000; // 12s = ~5 RPM (well under 15 RPM limit)
const RATE_LIMIT_PAUSE = 65000;    // Pause 65s when rate limited

const MODELS = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
let modelIndex = 0;
let modelFails = {};
MODELS.forEach(m => modelFails[m] = 0);

const config = { apiKey: process.env.GEMINI_API_KEY };
const stats = { generated: 0, failed: 0, apiCalls: 0, totalTokens: 0, errors: [] };

function nextModel() {
    for (let i = 0; i < MODELS.length; i++) {
        const idx = (modelIndex + i) % MODELS.length;
        if (modelFails[MODELS[idx]] < 3) {
            modelIndex = (idx + 1) % MODELS.length;
            return MODELS[idx];
        }
    }
    MODELS.forEach(m => modelFails[m] = 0);
    modelIndex = 1;
    return MODELS[0];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function compactFactSheet(stock, metrics) {
    const fs = {
        s: stock.symbol, n: stock.companyName, sec: stock.sector || '',
        ltp: stock.lastTradedPrice, pc: stock.previousClose,
        chg: stock.change, pct: stock.percentageChange,
        o: stock.openPrice, h: stock.highPrice, l: stock.lowPrice,
        vol: stock.volume, to: stock.turnover,
    };
    if (metrics?.priceMetrics) fs.pm = { h52: metrics.priceMetrics.high52w, l52: metrics.priceMetrics.low52w };
    if (metrics?.trendMetrics) fs.tm = { ma20: metrics.trendMetrics.ma20?.toFixed(1), trend: metrics.trendMetrics.trend };
    if (metrics?.momentumMetrics) fs.mm = { rsi14: metrics.momentumMetrics.rsi14?.toFixed(1) };
    if (metrics?.liquidityMetrics) fs.lm = { vr: metrics.liquidityMetrics.volumeRatio?.toFixed(1) };
    if (metrics?.signals?.length) fs.sig = metrics.signals.slice(0, 3).map(s => s.label).join(', ');
    if (metrics?.patterns?.postBonusAdjustment) fs.bonus = true;
    return fs;
}

function buildBatchPrompt(factSheets) {
    const data = factSheets.map((fs, i) => {
        let line = `${fs.s} (${fs.n}): LTP=${fs.ltp} PC=${fs.pc} Chg=${fs.chg}(${fs.pct}%) Vol=${fs.vol}`;
        if (fs.pm) line += ` 52H=${fs.pm.h52} 52L=${fs.pm.l52}`;
        if (fs.tm) line += ` MA20=${fs.tm.ma20} Trend=${fs.tm.trend}`;
        if (fs.mm) line += ` RSI=${fs.mm.rsi14}`;
        if (fs.sig) line += ` Signals:${fs.sig}`;
        if (fs.bonus) line += ` [POST-BONUS]`;
        return line;
    }).join('\n');

    return `NEPSE analyst. For each stock write: summary (2-3 sentences), bullets (3-5 points), outlook (1-2 sentences). No buy/sell advice. Data-driven only.

${data}

Return JSON object with stock symbols as keys:
{
  "${factSheets[0].s}": { "summary": "...", "bullets": ["..."], "outlook": "..." }${factSheets.length > 1 ? `,\n  "${factSheets[1].s}": { "summary": "...", "bullets": ["..."], "outlook": "..." }` : ''}${factSheets.length > 2 ? `,\n  "${factSheets[2].s}": { "summary": "...", "bullets": ["..."], "outlook": "..." }` : ''}
}`;
}

/**
 * Extract JSON from a potentially messy response
 */
function extractJSON(text) {
    // Try direct parse
    try { return JSON.parse(text); } catch {}

    // Remove markdown code blocks
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try { return JSON.parse(cleaned); } catch {}

    // Extract the outermost {...}
    let depth = 0, start = -1;
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') { if (depth === 0) start = i; depth++; }
        if (cleaned[i] === '}') { depth--; if (depth === 0 && start >= 0) {
            try { return JSON.parse(cleaned.slice(start, i + 1)); } catch {}
        }}
    }

    // Try fixing common issues: trailing commas, unescaped newlines
    if (start >= 0) {
        let jsonStr = cleaned.slice(start);
        // Remove trailing content after last }
        const lastBrace = jsonStr.lastIndexOf('}');
        if (lastBrace >= 0) jsonStr = jsonStr.slice(0, lastBrace + 1);
        // Fix trailing commas before }
        jsonStr = jsonStr.replace(/,\s*}/g, '}');
        jsonStr = jsonStr.replace(/,\s*]/g, ']');
        try { return JSON.parse(jsonStr); } catch {}
    }

    return null;
}

function parseBatchResponse(text, symbols) {
    const parsed = extractJSON(text);
    if (!parsed) {
        // Log first 200 chars for debugging
        console.log(`  [DEBUG] Raw response: ${text.slice(0, 200)}...`);
        throw new Error('Cannot extract JSON from response');
    }

    const results = {};
    if (Array.isArray(parsed)) {
        parsed.forEach(item => {
            const sym = (item.symbol || item.s || '').toUpperCase();
            if (sym && symbols.includes(sym)) results[sym] = item;
        });
    } else {
        for (const key of Object.keys(parsed)) {
            const upperKey = key.toUpperCase();
            if (symbols.includes(upperKey) && parsed[key]?.summary) {
                results[upperKey] = parsed[key];
            }
        }
    }
    return results;
}

async function callGemini(prompt, model) {
    const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${config.apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 4096,
                responseMimeType: 'application/json'
            }
        })
    });

    if (response.status === 429) throw new Error('RATE_LIMIT');
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`HTTP ${response.status}: ${err.slice(0, 150)}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response');

    stats.apiCalls++;
    const tokens = data?.usageMetadata?.totalTokenCount || 0;
    stats.totalTokens += tokens;
    return { text, tokenCount: tokens, model };
}

async function saveOverview(symbol, narrative, factSheet, model, tokenCount) {
    narrative.generatedAt = new Date().toISOString();
    await prisma.aIOverview.upsert({
        where: { symbol_type: { symbol: symbol.toUpperCase(), type: 'stock' } },
        update: {
            context: JSON.stringify(factSheet),
            narrative: JSON.stringify(narrative),
            modelVersion: model,
            tokenCount: Math.round(tokenCount),
            triggeredBy: 'batch-retry',
            updatedAt: new Date()
        },
        create: {
            symbol: symbol.toUpperCase(), type: 'stock',
            context: JSON.stringify(factSheet),
            narrative: JSON.stringify(narrative),
            modelVersion: model,
            tokenCount: Math.round(tokenCount),
            triggeredBy: 'batch-retry'
        }
    });
}

async function processBatch(batch, factSheets) {
    const symbols = batch.map(s => s.symbol);

    for (let attempt = 0; attempt < MODELS.length + 1; attempt++) {
        const model = attempt < MODELS.length ? MODELS[attempt % MODELS.length] : MODELS[0];
        
        if (attempt === MODELS.length) {
            // All models failed once, pause and retry first model
            console.log(`  ⏸️  Pausing ${RATE_LIMIT_PAUSE / 1000}s...`);
            await sleep(RATE_LIMIT_PAUSE);
            MODELS.forEach(m => modelFails[m] = Math.max(0, modelFails[m] - 2));
        }

        try {
            const result = await callGemini(buildBatchPrompt(factSheets), model);
            modelFails[model] = 0;

            const parsed = parseBatchResponse(result.text, symbols);
            const tps = Math.round(result.tokenCount / symbols.length);

            let ok = 0;
            for (let j = 0; j < batch.length; j++) {
                const sym = symbols[j];
                if (parsed[sym]?.summary) {
                    await saveOverview(sym, parsed[sym], factSheets[j], model, tps);
                    stats.generated++;
                    ok++;
                    process.stdout.write(`  ✓ ${sym}\n`);
                } else {
                    stats.failed++;
                    process.stdout.write(`  ✗ ${sym} (missing)\n`);
                }
            }
            console.log(`  📊 ${result.tokenCount} tok (${model}) ${ok}/${symbols.length}`);
            return;

        } catch (err) {
            if (err.message === 'RATE_LIMIT') {
                modelFails[model]++;
                console.log(`  ⏳ ${model} rate limited (#${modelFails[model]})`);
            } else {
                console.log(`  ❌ ${model}: ${err.message.slice(0, 100)}`);
            }
        }
    }

    // Complete failure
    symbols.forEach(s => { stats.failed++; stats.errors.push(s); });
    console.log(`  ❌ All attempts failed for batch`);
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  NEPSE AI Overview Generator v3 (Robust)            ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    if (!config.apiKey) { console.error('GEMINI_API_KEY not set!'); process.exit(1); }

    const existing = await prisma.aIOverview.findMany({ where: { type: 'stock' }, select: { symbol: true } });
    const existingSet = new Set(existing.map(e => e.symbol));

    const allStocks = await prisma.stock.findMany({
        where: { lastTradedPrice: { gt: 0 } },
        orderBy: { turnover: 'desc' }
    });
    const missing = allStocks.filter(s => !existingSet.has(s.symbol));

    console.log(`Done: ${existingSet.size} | Remaining: ${missing.length} | Total: ${allStocks.length}`);
    console.log(`Models: ${MODELS.join(' ↔ ')} | Batch: ${BATCH_SIZE} | Delay: ${DELAY_BETWEEN_CALLS / 1000}s\n`);

    if (missing.length === 0) {
        console.log('✅ All done!');
        await prisma.$disconnect();
        return;
    }

    // Pre-compute metrics
    process.stdout.write('Computing metrics... ');
    const mc = {};
    for (const s of missing) { try { mc[s.symbol] = await metricsOrchestrator.getMetrics(s.symbol); } catch { mc[s.symbol] = null; } }
    console.log('done.\n');

    const totalBatches = Math.ceil(missing.length / BATCH_SIZE);

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        const batch = missing.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        console.log(`[${batchNum}/${totalBatches}] ${batch.map(s => s.symbol).join(', ')}`);

        const factSheets = batch.map(s => compactFactSheet(s, mc[s.symbol]));
        await processBatch(batch, factSheets);

        if (i + BATCH_SIZE < missing.length) await sleep(DELAY_BETWEEN_CALLS);
    }

    console.log('\n══════════════════════════════════════════════════════');
    console.log(`✅ Generated: ${stats.generated} | ❌ Failed: ${stats.failed}`);
    console.log(`📡 API Calls: ${stats.apiCalls} | 🎯 Tokens: ${stats.totalTokens.toLocaleString()}`);

    const finalCount = await prisma.aIOverview.count({ where: { type: 'stock' } });
    console.log(`📊 DB Total: ${finalCount}/${allStocks.length}`);

    if (stats.errors.length > 0) {
        console.log(`\nFailed symbols: ${stats.errors.join(', ')}`);
    }

    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error('Fatal:', err);
    await prisma.$disconnect();
    process.exit(1);
});
