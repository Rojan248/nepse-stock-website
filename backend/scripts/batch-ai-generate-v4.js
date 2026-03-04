/**
 * AI Overview Regenerator v4 — Gemini + LM Studio Fallback (Resumable)
 *
 * Strategy:
 * - Gemini free tier first (rotate 4 models to spread rate limits)
 * - Batch 5 stocks per Gemini call (optimize API usage)
 * - On rate limit: rotate model, if all exhausted → LM Studio fallback
 * - LM Studio: single stock per call (local, no rate limits)
 * - RESUMABLE: skips stocks already refreshed by this script (triggeredBy='batch-v4')
 *   Use --force to override and regenerate everything
 *
 * Usage: node scripts/batch-ai-generate-v4.js [--market-only] [--force] [--no-lm]
 */

require('dotenv').config();
const { prisma } = require('../src/services/database/connection');
const metricsOrchestrator = require('../src/services/metrics/metricsOrchestrator');

// ── Config ──────────────────────────────────────────────────────────
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'];
const GEMINI_BATCH_SIZE = 5;
const GEMINI_DELAY = 4500;       // 4.5s between calls (~13 RPM, under 15 RPM free limit)
const RATE_LIMIT_PAUSE = 62000;  // 62s pause on rate limit

const LM_STUDIO_BASE_URL = process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234/v1';
const LM_STUDIO_KEY = process.env.LM_STUDIO_API_KEY || '';
const LM_STUDIO_MODEL = 'qwen/qwen2.5-vl-7b';

const GEMINI_KEY = process.env.GEMINI_API_KEY;

const stats = { geminiOk: 0, lmStudioOk: 0, failed: 0, apiCalls: 0, tokens: 0, rateLimits: 0 };
const modelFails = {};
GEMINI_MODELS.forEach(m => modelFails[m] = 0);
let geminiExhausted = false;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Compact fact sheet ──────────────────────────────────────────────
function compactFact(stock, metrics) {
    const f = {
        s: stock.symbol, n: stock.companyName, sec: stock.sector || '',
        ltp: stock.lastTradedPrice, pc: stock.previousClose,
        chg: stock.change, pct: stock.percentageChange,
        vol: stock.volume, to: stock.turnover,
    };
    if (metrics?.priceMetrics) f.pm = { h52: metrics.priceMetrics.high52w, l52: metrics.priceMetrics.low52w };
    if (metrics?.trendMetrics) f.tm = { ma20: metrics.trendMetrics.ma20?.toFixed(1), trend: metrics.trendMetrics.trend };
    if (metrics?.momentumMetrics?.rsi14) f.rsi = metrics.momentumMetrics.rsi14.toFixed(1);
    if (metrics?.liquidityMetrics?.volumeRatio) f.vr = metrics.liquidityMetrics.volumeRatio.toFixed(1);
    if (metrics?.signals?.length) f.sig = metrics.signals.slice(0, 3).map(s => s.label).join(', ');
    if (metrics?.patterns?.postBonusAdjustment) f.bonus = true;
    return f;
}

// ── Prompt builders ─────────────────────────────────────────────────
function buildBatchPrompt(facts) {
    const lines = facts.map(f => {
        let l = `${f.s}(${f.n}): LTP=${f.ltp} PC=${f.pc} Chg=${f.chg}(${f.pct}%) Vol=${f.vol}`;
        if (f.pm) l += ` 52H=${f.pm.h52} 52L=${f.pm.l52}`;
        if (f.tm) l += ` MA20=${f.tm.ma20} T=${f.tm.trend}`;
        if (f.rsi) l += ` RSI=${f.rsi}`;
        if (f.sig) l += ` [${f.sig}]`;
        if (f.bonus) l += ` [POST-BONUS]`;
        return l;
    }).join('\n');

    const keys = facts.map(f => `  "${f.s}": {"summary":"...","bullets":["..."],"outlook":"..."}`).join(',\n');

    return `NEPSE analyst. For each stock: summary(2-3 sentences), bullets(3-5), outlook(1-2 sentences). Data-driven, no buy/sell.

${lines}

Return ONLY valid JSON:
{
${keys}
}`;
}

function buildSinglePrompt(f) {
    let data = `${f.s} (${f.n}): LTP=${f.ltp} PC=${f.pc} Chg=${f.chg}(${f.pct}%) Vol=${f.vol}`;
    if (f.pm) data += ` 52WH=${f.pm.h52} 52WL=${f.pm.l52}`;
    if (f.tm) data += ` MA20=${f.tm.ma20} Trend=${f.tm.trend}`;
    if (f.rsi) data += ` RSI14=${f.rsi}`;
    if (f.vr) data += ` VolRatio=${f.vr}x`;
    if (f.sig) data += ` Signals: ${f.sig}`;
    if (f.bonus) data += ` [POST-BONUS ADJUSTMENT]`;

    return `You are a NEPSE stock analyst. Given this data, provide a brief analysis.

${data}

Return ONLY valid JSON (no markdown, no code blocks):
{"summary":"2-3 sentence overview","bullets":["point1","point2","point3"],"outlook":"1-2 sentence outlook"}`;
}

function buildMarketPrompt(marketMetrics, marketSummary) {
    const sectors = (marketMetrics?.sectors || []).slice(0, 8)
        .map(s => `${s.name}: avg ${s.avgChange.toFixed(2)}%, ${s.advancing}up ${s.declining}dn`)
        .join('; ');

    return `NEPSE market analyst. Today's data:
Index: ${marketSummary?.indexValue || 'N/A'} Change: ${marketSummary?.indexChange || 0}(${marketSummary?.indexChangePercent || 0}%)
Turnover: Rs${marketSummary?.totalTurnover || 0} Vol: ${marketSummary?.totalVolume || 0}
Adv: ${marketMetrics?.advancing || 0} Dec: ${marketMetrics?.declining || 0} Unchg: ${marketMetrics?.unchanged || 0}
Sectors: ${sectors}

Return ONLY valid JSON:
{"summary":"2-3 sentences","bullets":["...","...","..."],"outlook":"1-2 sentences"}`;
}

// ── JSON extraction ─────────────────────────────────────────────────
function extractJSON(text) {
    try { return JSON.parse(text); } catch {}
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try { return JSON.parse(cleaned); } catch {}
    let depth = 0, start = -1;
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') { if (depth === 0) start = i; depth++; }
        if (cleaned[i] === '}') { depth--; if (depth === 0 && start >= 0) {
            try { return JSON.parse(cleaned.slice(start, i + 1)); } catch {}
        }}
    }
    if (start >= 0) {
        let s = cleaned.slice(start, cleaned.lastIndexOf('}') + 1);
        s = s.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        try { return JSON.parse(s); } catch {}
    }
    return null;
}

// ── API callers ─────────────────────────────────────────────────────
async function callGemini(prompt, model) {
    const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096, responseMimeType: 'application/json' }
        })
    });
    if (res.status === 429) { stats.rateLimits++; throw new Error('RATE_LIMIT'); }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response');
    stats.apiCalls++;
    const tok = data?.usageMetadata?.totalTokenCount || 0;
    stats.tokens += tok;
    return { text, tokens: tok, model };
}

async function callLMStudio(prompt) {
    const url = `${LM_STUDIO_BASE_URL}/chat/completions`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LM_STUDIO_KEY}`
        },
        body: JSON.stringify({
            model: LM_STUDIO_MODEL,
            messages: [
                { role: 'system', content: 'You are a NEPSE stock market analyst. Respond ONLY in valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 2048
        })
    });
    if (!res.ok) throw new Error(`LM Studio HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty LM Studio response');
    stats.apiCalls++;
    return { text, tokens: data?.usage?.total_tokens || 0, model: `lmstudio:${LM_STUDIO_MODEL}` };
}

// ── Save to DB ──────────────────────────────────────────────────────
async function saveOverview(symbol, narrative, factSheet, model, tokenCount, type = 'stock') {
    narrative.generatedAt = new Date().toISOString();
    await prisma.aIOverview.upsert({
        where: { symbol_type: { symbol: symbol.toUpperCase(), type } },
        update: {
            context: JSON.stringify(factSheet),
            narrative: JSON.stringify(narrative),
            modelVersion: model,
            tokenCount: Math.round(tokenCount),
            triggeredBy: 'batch-v4',
            updatedAt: new Date()
        },
        create: {
            symbol: symbol.toUpperCase(), type,
            context: JSON.stringify(factSheet),
            narrative: JSON.stringify(narrative),
            modelVersion: model,
            tokenCount: Math.round(tokenCount),
            triggeredBy: 'batch-v4'
        }
    });
}

// ── Process batch via Gemini ────────────────────────────────────────
async function processGeminiBatch(batch, facts) {
    const symbols = batch.map(s => s.symbol);
    const prompt = buildBatchPrompt(facts);

    for (let i = 0; i < GEMINI_MODELS.length; i++) {
        const model = GEMINI_MODELS[i % GEMINI_MODELS.length];
        if (modelFails[model] >= 3) continue;

        try {
            const result = await callGemini(prompt, model);
            modelFails[model] = 0;
            const parsed = extractJSON(result.text);
            if (!parsed) throw new Error('JSON parse failed');

            const tps = Math.round(result.tokens / symbols.length);
            let ok = 0;
            for (let j = 0; j < batch.length; j++) {
                const sym = symbols[j];
                const entry = parsed[sym] || parsed[sym.toLowerCase()];
                if (entry?.summary) {
                    await saveOverview(sym, entry, facts[j], model, tps);
                    stats.geminiOk++;
                    ok++;
                    process.stdout.write(`  G ${sym}\n`);
                }
            }
            // Return symbols that weren't in the response (need LM Studio)
            return symbols.filter(s => !(parsed[s] || parsed[s.toLowerCase()])?.summary);

        } catch (err) {
            if (err.message === 'RATE_LIMIT') {
                modelFails[model]++;
                console.log(`  ~ ${model} rate limited (#${modelFails[model]})`);
                if (GEMINI_MODELS.every(m => modelFails[m] >= 3)) {
                    geminiExhausted = true;
                    console.log('  >> All Gemini models exhausted, switching to LM Studio');
                    return symbols; // All need LM Studio
                }
            } else {
                console.log(`  ! ${model}: ${err.message.slice(0, 80)}`);
                modelFails[model]++;
            }
        }
    }
    return symbols; // All failed → LM Studio
}

// ── Process single stock via LM Studio ──────────────────────────────
async function processLMStudio(symbol, fact) {
    try {
        const prompt = buildSinglePrompt(fact);
        const result = await callLMStudio(prompt);
        const parsed = extractJSON(result.text);
        if (!parsed?.summary) throw new Error('Bad JSON from LM Studio');

        await saveOverview(symbol, parsed, fact, result.model, result.tokens);
        stats.lmStudioOk++;
        process.stdout.write(`  L ${symbol}\n`);
        return true;
    } catch (err) {
        console.log(`  X ${symbol}: ${err.message.slice(0, 80)}`);
        stats.failed++;
        return false;
    }
}

// ── Market overview ─────────────────────────────────────────────────
async function generateMarketOverview() {
    console.log('\n--- Market Overview ---');
    try {
        const marketMetrics = await metricsOrchestrator.getMarketMetrics();
        const marketSummary = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });
        if (!marketSummary) { console.log('  No market summary data'); return; }

        const prompt = buildMarketPrompt(marketMetrics, marketSummary);

        // Try Gemini first
        if (!geminiExhausted && GEMINI_KEY) {
            for (const model of GEMINI_MODELS) {
                if (modelFails[model] >= 3) continue;
                try {
                    const result = await callGemini(prompt, model);
                    const parsed = extractJSON(result.text);
                    if (parsed?.summary) {
                        await saveOverview('MARKET', parsed, { marketMetrics, marketSummary }, model, result.tokens, 'market');
                        console.log(`  G MARKET (${model}, ${result.tokens} tok)`);
                        return;
                    }
                } catch (err) {
                    if (err.message === 'RATE_LIMIT') modelFails[model]++;
                }
            }
        }

        // LM Studio fallback
        const result = await callLMStudio(prompt);
        const parsed = extractJSON(result.text);
        if (parsed?.summary) {
            await saveOverview('MARKET', parsed, { marketMetrics, marketSummary }, result.model, result.tokens, 'market');
            console.log(`  L MARKET (lmstudio)`);
        } else {
            console.log('  X MARKET: parse failed');
        }
    } catch (err) {
        console.log(`  X MARKET: ${err.message.slice(0, 100)}`);
    }
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
    const forceMode = process.argv.includes('--force');
    const marketOnly = process.argv.includes('--market-only');
    const noLM = process.argv.includes('--no-lm');

    console.log('=== NEPSE AI Overview Regenerator v4 ===');
    console.log(`Gemini: ${GEMINI_KEY ? 'configured' : 'MISSING'} | LM Studio: ${LM_STUDIO_KEY && !noLM ? 'configured' : 'DISABLED'}`);
    console.log(`Gemini models: ${GEMINI_MODELS.join(', ')}`);
    console.log(`Mode: ${forceMode ? 'FORCE (regenerate all)' : 'RESUME (skip batch-v4 entries)'}\n`);

    if (!GEMINI_KEY && (!LM_STUDIO_KEY || noLM)) {
        console.error('No API keys configured!');
        process.exit(1);
    }

    // Get all stocks
    const allStocks = await prisma.stock.findMany({
        where: { lastTradedPrice: { gt: 0 } },
        orderBy: { turnover: 'desc' }
    });

    if (!marketOnly) {
        // Find which stocks need regeneration
        let stocksToProcess;
        if (forceMode) {
            stocksToProcess = allStocks;
        } else {
            // Skip stocks already refreshed by batch-v4
            const alreadyDone = await prisma.aIOverview.findMany({
                where: { type: 'stock', triggeredBy: 'batch-v4' },
                select: { symbol: true }
            });
            const doneSet = new Set(alreadyDone.map(o => o.symbol));
            stocksToProcess = allStocks.filter(s => !doneSet.has(s.symbol));
        }

        console.log(`Total stocks: ${allStocks.length} | To process: ${stocksToProcess.length} | Already done (v4): ${allStocks.length - stocksToProcess.length}`);

        if (stocksToProcess.length === 0) {
            console.log('\nAll stocks already refreshed by v4. Use --force to regenerate.');
        } else {
            // Pre-compute metrics
            process.stdout.write('Computing metrics... ');
            const mc = {};
            for (const s of stocksToProcess) {
                try { mc[s.symbol] = await metricsOrchestrator.getMetrics(s.symbol); } catch { mc[s.symbol] = null; }
            }
            console.log('done.\n');

            const totalBatches = Math.ceil(stocksToProcess.length / GEMINI_BATCH_SIZE);
            const lmStudioQueue = []; // stocks that need LM Studio

            // Phase 1: Gemini batches (exhaust free tier)
            if (GEMINI_KEY && !geminiExhausted) {
                console.log(`--- Phase 1: Gemini (batch ${GEMINI_BATCH_SIZE}, ${totalBatches} batches) ---`);
                for (let i = 0; i < stocksToProcess.length; i += GEMINI_BATCH_SIZE) {
                    if (geminiExhausted) {
                        // Queue remaining for LM Studio
                        for (let j = i; j < stocksToProcess.length; j++) {
                            lmStudioQueue.push({ stock: stocksToProcess[j], fact: compactFact(stocksToProcess[j], mc[stocksToProcess[j].symbol]) });
                        }
                        break;
                    }

                    const batch = stocksToProcess.slice(i, i + GEMINI_BATCH_SIZE);
                    const batchNum = Math.floor(i / GEMINI_BATCH_SIZE) + 1;
                    const facts = batch.map(s => compactFact(s, mc[s.symbol]));

                    console.log(`[${batchNum}/${totalBatches}] ${batch.map(s => s.symbol).join(', ')}`);
                    const missed = await processGeminiBatch(batch, facts);

                    // Queue missed symbols for LM Studio
                    for (const sym of missed) {
                        const stock = batch.find(s => s.symbol === sym);
                        if (stock) lmStudioQueue.push({ stock, fact: compactFact(stock, mc[sym]) });
                    }

                    if (i + GEMINI_BATCH_SIZE < stocksToProcess.length && !geminiExhausted) {
                        await sleep(GEMINI_DELAY);
                    }
                }
            } else if (!GEMINI_KEY) {
                // No Gemini key, queue everything for LM Studio
                for (const s of stocksToProcess) {
                    lmStudioQueue.push({ stock: s, fact: compactFact(s, mc[s.symbol]) });
                }
            }

            // Phase 2: LM Studio for missed stocks
            if (lmStudioQueue.length > 0 && LM_STUDIO_KEY && !noLM) {
                console.log(`\n--- Phase 2: LM Studio (${lmStudioQueue.length} stocks) ---`);
                for (let i = 0; i < lmStudioQueue.length; i++) {
                    const { stock, fact } = lmStudioQueue[i];
                    await processLMStudio(stock.symbol, fact);
                    // Small delay to not overwhelm local GPU
                    if (i < lmStudioQueue.length - 1) await sleep(500);
                }
            } else if (lmStudioQueue.length > 0 && (noLM || !LM_STUDIO_KEY)) {
                console.log(`\n${lmStudioQueue.length} stocks still need processing (LM Studio disabled/not configured)`);
                console.log('Run again later when Gemini quota resets, or without --no-lm');
                stats.failed += lmStudioQueue.length;
            }
        }
    }

    // Phase 3: Market overview
    await generateMarketOverview();

    // Summary
    console.log('\n=== Results ===');
    console.log(`Gemini OK:    ${stats.geminiOk}`);
    console.log(`LM Studio OK: ${stats.lmStudioOk}`);
    console.log(`Failed:       ${stats.failed}`);
    console.log(`API Calls:    ${stats.apiCalls}`);
    console.log(`Tokens:       ${stats.tokens.toLocaleString()}`);
    console.log(`Rate Limits:  ${stats.rateLimits}`);

    const finalCount = await prisma.aIOverview.count({ where: { type: 'stock' } });
    const v4Count = await prisma.aIOverview.count({ where: { type: 'stock', triggeredBy: 'batch-v4' } });
    const total = await prisma.stock.count({ where: { lastTradedPrice: { gt: 0 } } });
    console.log(`DB Coverage:  ${finalCount}/${total} (${v4Count} via v4)`);

    if (stats.failed > 0 || v4Count < total) {
        console.log(`\nTip: Run again later to process remaining stocks when Gemini resets`);
    }

    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error('Fatal:', err);
    await prisma.$disconnect();
    process.exit(1);
});
