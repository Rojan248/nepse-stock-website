/**
 * batch-ai-autonomous.js — Fully Autonomous AI Overview Generator
 *
 * Runs until every stock has an AI overview, no matter how long it takes.
 * Handles Gemini free-tier limits gracefully: rotates models, waits on rate
 * limits, and resumes automatically when quota resets.
 *
 * Rate-limit strategy:
 *   RPM (requests-per-minute) 429  → wait 65 s, rotate to next model
 *   3+ consecutive 429s per model  → assume daily quota, put model on 2-hr cooldown
 *   All models on daily quota      → immediately fall through to Copilot (no wait)
 *   All models on RPM cooldown     → sleep until the earliest model becomes available
 *
 * Three-layer fallback (in order):
 *   1. Gemini (4 models rotating, free tier)
 *   2. GitHub Copilot (gpt-4o-mini, activated on Gemini quota exhaustion)
 *   3. GitHub Models  (gpt-4o-mini, free-tier, final safety net)
 *
 * Resumability:
 *   Default: skips stocks that already have any overview in the DB
 *   --force:  regenerates all stocks (overwrites existing)
 *   The script tags overviews it creates with triggeredBy = 'autonomous'
 *
 * Usage:
 *   node scripts/batch-ai-autonomous.js              # resume from current state
 *   node scripts/batch-ai-autonomous.js --force      # redo all overviews
 *   node scripts/batch-ai-autonomous.js --no-gh      # skip GitHub Models fallback
 *   node scripts/batch-ai-autonomous.js --dry-run    # show what would be done
 */

require('dotenv').config();
const { prisma } = require('../src/services/database/connection');
const metricsOrchestrator = require('../src/services/metrics/metricsOrchestrator');

// ── Constants ────────────────────────────────────────────────────────────────

const GEMINI_BASE     = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODELS   = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
];
const BATCH_SIZE           = 5;        // stocks per Gemini call
const INTER_CALL_DELAY_MS  = 4800;     // ~12.5 RPM — safely under 15 RPM free limit
const RPM_COOLDOWN_MS      = 65_000;   // wait after a single rate-limit hit
const QUOTA_COOLDOWN_MS    = 2 * 60 * 60 * 1000; // 2-hr cooldown → assume daily quota
const CONSEC_RL_THRESHOLD  = 3;        // consecutive 429s before quota cooldown
const TRIGGERED_BY         = 'autonomous';

const GEMINI_KEY    = process.env.GEMINI_API_KEY;
const GH_TOKEN      = process.env.GITHUB_TOKEN || '';
const GH_BASE       = 'https://models.inference.ai.azure.com';
const GH_MODEL      = 'gpt-4o-mini';
const COPILOT_BASE  = 'https://api.githubcopilot.com';
const COPILOT_MODEL = 'gpt-4o-mini';

// ── Per-model state ──────────────────────────────────────────────────────────

/** @type {Record<string, { consecRL: number, cooldownUntil: number, totalRL: number, totalOk: number }>} */
const modelState = Object.fromEntries(
    GEMINI_MODELS.map(m => [m, { consecRL: 0, cooldownUntil: 0, totalRL: 0, totalOk: 0 }])
);

// ── Global stats ─────────────────────────────────────────────────────────────

const stats = {
    geminiOk: 0, copilotOk: 0, ghOk: 0, failed: 0,
    apiCalls: 0, tokens: 0, rateLimits: 0,
    rounds: 0, startTime: Date.now()
};

// ── Utilities ────────────────────────────────────────────────────────────────

const sleep  = ms  => new Promise(r => setTimeout(r, ms));
const log    = msg => console.log(`[${new Date().toISOString()}] ${msg}`);
const elapsed = () => Math.round((Date.now() - stats.startTime) / 1000);
const fmt    = ms  => `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;

/** Pick the model with the fewest consecutive rate-limits that is not in cooldown. */
function pickModel() {
    const now = Date.now();
    const available = GEMINI_MODELS.filter(m => modelState[m].cooldownUntil <= now);
    if (available.length === 0) return null;
    return available.sort((a, b) => modelState[a].consecRL - modelState[b].consecRL)[0];
}

/** Earliest timestamp at which any model's cooldown expires. */
function earliestCooldownEnd() {
    return Math.min(...GEMINI_MODELS.map(m => modelState[m].cooldownUntil));
}

/** True when every Gemini model has hit the consecutive-RL quota threshold. */
function allModelsOnQuotaCooldown() {
    return GEMINI_MODELS.every(m => modelState[m].consecRL >= CONSEC_RL_THRESHOLD);
}

// ── Fact sheet ───────────────────────────────────────────────────────────────

function buildFact(stock, metrics) {
    const f = {
        s: stock.symbol,
        n: stock.companyName,
        sec: stock.sector || 'N/A',
        ltp: stock.lastTradedPrice,
        pc:  stock.previousClose,
        chg: stock.change,
        pct: stock.percentageChange,
        vol: stock.volume,
        to:  stock.turnover,
    };
    const pm = metrics?.priceMetrics;
    const tm = metrics?.trendMetrics;
    const mm = metrics?.momentumMetrics;
    const lm = metrics?.liquidityMetrics;

    if (pm) {
        f.pm = { h52: pm.high52w, l52: pm.low52w };
        if (pm.yearlyChange != null) f.pm.yChg = pm.yearlyChange.toFixed(1);
    }
    if (tm) {
        f.tm = { trend: tm.trend };
        if (tm.ma20)         f.tm.ma20   = tm.ma20.toFixed(1);
        if (tm.ma180)        f.tm.ma180  = tm.ma180.toFixed(1);
        if (tm.priceVsMa180) f.tm.vsMa180 = tm.priceVsMa180.toFixed(1) + '%';
    }
    if (mm?.rsi14)                    f.rsi = mm.rsi14.toFixed(1);
    if (lm?.volumeRatio)              f.vr  = lm.volumeRatio.toFixed(1);
    if (metrics?.signals?.length)     f.sig = metrics.signals.slice(0, 3).map(s => s.label).join(', ');
    if (metrics?.patterns?.postBonusAdjustment) f.bonus = true;
    return f;
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function batchPrompt(facts) {
    const lines = facts.map(f => {
        let l = `${f.s}(${f.n},${f.sec}): LTP=${f.ltp} PC=${f.pc} Chg=${f.chg}(${f.pct}%) Vol=${f.vol}`;
        if (f.pm)         l += ` 52H=${f.pm.h52} 52L=${f.pm.l52}`;
        if (f.pm?.yChg)   l += ` 1Y=${f.pm.yChg}%`;
        if (f.tm)         l += ` Trend=${f.tm.trend}`;
        if (f.tm?.ma20)   l += ` MA20=${f.tm.ma20}`;
        if (f.tm?.ma180)  l += ` MA180=${f.tm.ma180}(${f.tm.vsMa180})`;
        if (f.rsi)        l += ` RSI=${f.rsi}`;
        if (f.sig)        l += ` [${f.sig}]`;
        if (f.bonus)      l += ` [POST-BONUS]`;
        return l;
    }).join('\n');

    const schema = facts.map(
        f => `  "${f.s}": {"summary":"...","bullets":["...","...","..."],"outlook":"..."}`
    ).join(',\n');

    return `NEPSE analyst. For each stock produce: summary (2-3 sentences), bullets (3-5 key points), outlook (1-2 sentences). Be data-driven, no buy/sell recommendations.

${lines}

Respond with ONLY valid JSON — no markdown, no extra text:
{
${schema}
}`;
}

function singlePrompt(f) {
    let d = `${f.s} (${f.n}, ${f.sec}): LTP=${f.ltp} PC=${f.pc} Chg=${f.chg}(${f.pct}%) Vol=${f.vol}`;
    if (f.pm)        d += ` 52WH=${f.pm.h52} 52WL=${f.pm.l52}`;
    if (f.pm?.yChg)  d += ` 1YReturn=${f.pm.yChg}%`;
    if (f.tm)        d += ` Trend=${f.tm.trend}`;
    if (f.tm?.ma20)  d += ` MA20=${f.tm.ma20}`;
    if (f.tm?.ma180) d += ` MA180=${f.tm.ma180}`;
    if (f.rsi)       d += ` RSI14=${f.rsi}`;
    if (f.vr)        d += ` VolRatio=${f.vr}x`;
    if (f.sig)       d += ` Signals:${f.sig}`;
    if (f.bonus)     d += ` [POST-BONUS ADJUSTMENT]`;
    return `You are a NEPSE stock analyst. Analyse the following data and respond with ONLY valid JSON — no markdown, no extra text.

${d}

{"summary":"2-3 sentence overview","bullets":["point1","point2","point3"],"outlook":"1-2 sentence outlook"}`;
}

function marketPrompt(mMetrics, mSummary) {
    const sectors = (mMetrics?.sectors || []).slice(0, 8)
        .map(s => `${s.name}: avg ${s.avgChange?.toFixed(2)}%, ${s.advancing}↑ ${s.declining}↓`)
        .join('; ');
    return `NEPSE market analyst. Today's session:
Index: ${mSummary?.indexValue || 'N/A'} Change: ${mSummary?.indexChange || 0}(${mSummary?.indexChangePercent || 0}%)
Turnover: Rs${mSummary?.totalTurnover || 0}  Volume: ${mSummary?.totalVolume || 0}
Advancing: ${mMetrics?.advancing || 0}  Declining: ${mMetrics?.declining || 0}  Unchanged: ${mMetrics?.unchanged || 0}
Sectors: ${sectors}

Return ONLY valid JSON:
{"summary":"2-3 sentences","bullets":["...","...","..."],"outlook":"1-2 sentences"}`;
}

// ── JSON extraction ───────────────────────────────────────────────────────────

function extractJSON(text) {
    // Direct parse
    try { return JSON.parse(text); } catch {}
    // Strip markdown fences
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try { return JSON.parse(cleaned); } catch {}
    // Find outermost braces
    let depth = 0; let start = -1;
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') { if (depth === 0) start = i; depth++; }
        if (cleaned[i] === '}') {
            depth--;
            if (depth === 0 && start >= 0) {
                try { return JSON.parse(cleaned.slice(start, i + 1)); } catch {}
            }
        }
    }
    // Last-resort: fix trailing commas
    if (start >= 0) {
        const chunk = cleaned.slice(start, cleaned.lastIndexOf('}') + 1)
            .replace(/,(\s*[}\]])/g, '$1');
        try { return JSON.parse(chunk); } catch {}
    }
    return null;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function callGemini(prompt, model) {
    const res = await fetch(
        `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    topP: 0.8,
                    maxOutputTokens: 4096,
                    responseMimeType: 'application/json'
                }
            })
        }
    );
    if (res.status === 429) {
        stats.rateLimits++;
        throw Object.assign(new Error('RATE_LIMIT'), { status: 429 });
    }
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');
    stats.apiCalls++;
    stats.tokens += data?.usageMetadata?.totalTokenCount || 0;
    return { text, tokens: data?.usageMetadata?.totalTokenCount || 0, model };
}

async function callGitHubModels(prompt) {
    const res = await fetch(`${GH_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GH_TOKEN}`
        },
        body: JSON.stringify({
            model: GH_MODEL,
            messages: [
                { role: 'system', content: 'You are a NEPSE stock market analyst. Respond ONLY with valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 2048
        })
    });
    if (res.status === 429) {
        stats.rateLimits++;
        throw Object.assign(new Error('RATE_LIMIT'), { status: 429 });
    }
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`GitHub Models HTTP ${res.status}: ${body.slice(0, 120)}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty GitHub Models response');
    stats.apiCalls++;
    return { text, tokens: data?.usage?.total_tokens || 0, model: `github:${GH_MODEL}` };
}

// ── DB save ───────────────────────────────────────────────────────────────────

async function saveOverview(symbol, narrative, factSheet, model, tokenCount, type = 'stock') {
    narrative.generatedAt = new Date().toISOString();
    await prisma.aIOverview.upsert({
        where: { symbol_type: { symbol: symbol.toUpperCase(), type } },
        update: {
            context:      JSON.stringify(factSheet),
            narrative:    JSON.stringify(narrative),
            modelVersion: model,
            tokenCount:   Math.round(tokenCount),
            triggeredBy:  TRIGGERED_BY,
            updatedAt:    new Date()
        },
        create: {
            symbol:       symbol.toUpperCase(),
            type,
            context:      JSON.stringify(factSheet),
            narrative:    JSON.stringify(narrative),
            modelVersion: model,
            tokenCount:   Math.round(tokenCount),
            triggeredBy:  TRIGGERED_BY
        }
    });
}

// ── Rate-limit handler ────────────────────────────────────────────────────────

/**
 * Record a rate-limit hit and compute cooldown.
 * Returns the cooldown duration applied.
 */
function handleRateLimit(model) {
    const ms = modelState[model];
    ms.consecRL++;
    ms.totalRL++;
    const isQuota = ms.consecRL >= CONSEC_RL_THRESHOLD;
    const cooldown = isQuota ? QUOTA_COOLDOWN_MS : RPM_COOLDOWN_MS;
    ms.cooldownUntil = Date.now() + cooldown;
    log(`  ⏸ ${model} rate-limited (#${ms.consecRL}) → cooldown ${fmt(cooldown)}${isQuota ? ' [daily quota assumed]' : ''}`);
    return cooldown;
}

// ── Gemini batch processor ────────────────────────────────────────────────────

/**
 * Try to process a batch of stocks via Gemini.
 * Returns an array of symbols that were NOT successfully saved (need retry).
 */
async function processGeminiBatch(stocks, facts) {
    const symbols = stocks.map(s => s.symbol);
    const model = pickModel();
    if (!model) return symbols; // all models in cooldown

    try {
        const result = await callGemini(batchPrompt(facts), model);
        modelState[model].consecRL = 0;
        modelState[model].totalOk++;

        const parsed = extractJSON(result.text);
        if (!parsed) throw new Error('JSON parse failed');

        const tokPerStock = Math.round(result.tokens / symbols.length);
        const missed = [];
        for (let i = 0; i < stocks.length; i++) {
            const sym = symbols[i];
            const entry = parsed[sym] || parsed[sym.toLowerCase()];
            if (entry?.summary) {
                await saveOverview(sym, entry, facts[i], model, tokPerStock);
                stats.geminiOk++;
                process.stdout.write(`  ✓ ${sym} (G)\n`);
            } else {
                missed.push(sym);
            }
        }
        return missed;

    } catch (err) {
        if (err.status === 429) {
            handleRateLimit(model);
        } else {
            log(`  ✗ ${model}: ${err.message.slice(0, 100)}`);
            modelState[model].consecRL++;
        }
        return symbols; // entire batch failed, retry later
    }
}

// ── GitHub Models processor ───────────────────────────────────────────────────

async function processGitHubModels(symbol, fact) {
    try {
        const result = await callGitHubModels(singlePrompt(fact));
        const parsed = extractJSON(result.text);
        if (!parsed?.summary) throw new Error('Invalid JSON structure');
        await saveOverview(symbol, parsed, fact, result.model, result.tokens);
        stats.ghOk++;
        process.stdout.write(`  ✓ ${symbol} (GH)\n`);
        return true;
    } catch (err) {
        if (err.status === 429) {
            log(`  ⏸ GitHub Models rate-limited for ${symbol} — backing off 65s`);
            await sleep(65_000);
        } else {
            log(`  ✗ GH ${symbol}: ${err.message.slice(0, 80)}`);
        }
        stats.failed++;
        return false;
    }
}

// ── GitHub Copilot processor ──────────────────────────────────────────────────

async function callGitHubCopilot(prompt) {
    const res = await fetch(`${COPILOT_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GH_TOKEN}`,
            'Copilot-Integration-Id': 'vscode-chat'
        },
        body: JSON.stringify({
            model: COPILOT_MODEL,
            messages: [
                { role: 'system', content: 'You are a NEPSE stock market analyst. Respond ONLY with valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 2048
        })
    });
    if (res.status === 429) {
        stats.rateLimits++;
        throw Object.assign(new Error('RATE_LIMIT'), { status: 429 });
    }
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Copilot HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty Copilot response');
    stats.apiCalls++;
    return { text, tokens: data?.usage?.total_tokens || 0, model: `copilot:${COPILOT_MODEL}` };
}

async function processCopilot(symbol, fact) {
    try {
        const result = await callGitHubCopilot(singlePrompt(fact));
        const parsed = extractJSON(result.text);
        if (!parsed?.summary) throw new Error('Invalid JSON structure');
        await saveOverview(symbol, parsed, fact, result.model, result.tokens);
        stats.copilotOk++;
        process.stdout.write(`  ✓ ${symbol} (CP)\n`);
        return true;
    } catch (err) {
        if (err.status === 429) {
            log(`  ⏸ Copilot rate-limited for ${symbol} — backing off 65s`);
            await sleep(65_000);
        } else {
            log(`  ✗ CP ${symbol}: ${err.message.slice(0, 100)}`);
        }
        stats.failed++;
        return false;
    }
}

// ── Market overview ───────────────────────────────────────────────────────────

async function generateMarketOverview() {
    log('\n--- Market Overview ---');
    try {
        const mMetrics = await metricsOrchestrator.getMarketMetrics();
        const mSummary = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });
        if (!mSummary) { log('  No market summary data, skipping'); return; }

        const prompt = marketPrompt(mMetrics, mSummary);
        const model  = pickModel();

        if (model && GEMINI_KEY) {
            try {
                const result = await callGemini(prompt, model);
                const parsed = extractJSON(result.text);
                if (parsed?.summary) {
                    await saveOverview('MARKET', parsed, { mMetrics, mSummary }, model, result.tokens, 'market');
                    log(`  ✓ MARKET (${model}, ${result.tokens} tok)`);
                    return;
                }
            } catch (err) {
                if (err.status === 429) handleRateLimit(model);
                else log(`  Gemini failed: ${err.message.slice(0, 80)}`);
            }
        }

        // GitHub Copilot fallback (when Gemini quota exhausted)
        if (GH_TOKEN) {
            try {
                const result = await callGitHubCopilot(prompt);
                const parsed = extractJSON(result.text);
                if (parsed?.summary) {
                    await saveOverview('MARKET', parsed, { mMetrics, mSummary }, result.model, result.tokens, 'market');
                    log('  ✓ MARKET (GitHub Copilot)');
                    return;
                }
            } catch (err) {
                log(`  ✗ MARKET Copilot: ${err.message.slice(0, 100)}`);
            }
            // Final fallback: GitHub Models
            try {
                const result = await callGitHubModels(prompt);
                const parsed = extractJSON(result.text);
                if (parsed?.summary) {
                    await saveOverview('MARKET', parsed, { mMetrics, mSummary }, result.model, result.tokens, 'market');
                    log('  ✓ MARKET (GitHub Models)');
                }
            } catch (err) {
                log(`  ✗ MARKET GH: ${err.message.slice(0, 80)}`);
            }
        } else {
            log('  ✗ No available model for market overview');
        }
    } catch (err) {
        log(`  ✗ Market overview error: ${err.message}`);
    }
}

// ── Stock list helpers ────────────────────────────────────────────────────────

async function getAllActiveStocks() {
    return prisma.stock.findMany({
        where: { lastTradedPrice: { gt: 0 } },
        orderBy: { turnover: 'desc' }
    });
}

async function getRemainingStocks(allStocks, forceMode) {
    if (forceMode) return allStocks;
    const done = new Set(
        (await prisma.aIOverview.findMany({
            where: { type: 'stock' },
            select: { symbol: true }
        })).map(o => o.symbol)
    );
    return allStocks.filter(s => !done.has(s.symbol));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const forceMode = process.argv.includes('--force');
    const dryRun    = process.argv.includes('--dry-run');
    const noGH      = process.argv.includes('--no-gh');
    const useGH     = GH_TOKEN && !noGH;

    log('════════════════════════════════════════════');
    log('   NEPSE AI Overview — Autonomous Generator  ');
    log('════════════════════════════════════════════');
    log(`Gemini key     : ${GEMINI_KEY ? 'configured' : 'MISSING'}`);
    log(`GitHub Copilot : ${useGH ? 'configured (quota fallback)' : noGH ? 'disabled (--no-gh)' : 'not configured'}`);
    log(`GitHub Models  : ${useGH ? 'configured (final fallback)' : 'not configured'}`);
    log(`Models         : ${GEMINI_MODELS.join(', ')}`);
    log(`Batch size     : ${BATCH_SIZE} | Inter-call delay: ${INTER_CALL_DELAY_MS}ms`);
    log(`Mode           : ${forceMode ? 'FORCE (regenerate all)' : 'RESUME (skip existing)'}`);
    log('');

    if (!GEMINI_KEY && !useGH) {
        console.error('ERROR: No API keys configured. Set GEMINI_API_KEY or GITHUB_TOKEN in .env');
        process.exit(1);
    }

    const allStocks = await getAllActiveStocks();
    log(`Active stocks in DB: ${allStocks.length}`);

    if (dryRun) {
        const remaining = await getRemainingStocks(allStocks, forceMode);
        log(`[Dry run] Would process: ${remaining.length} stocks`);
        if (remaining.length <= 30) remaining.forEach(s => log(`  - ${s.symbol}`));
        else log(`  First 10: ${remaining.slice(0, 10).map(s => s.symbol).join(', ')} ...`);
        await prisma.$disconnect();
        return;
    }

    // ── Main processing loop ──────────────────────────────────────────────────
    // Continues indefinitely until every stock has an overview.

    let round = 0;

    while (true) {
        round++;
        stats.rounds = round;

        // On first round with --force, regenerate everything
        const isForceRound = forceMode && round === 1;
        const remaining = await getRemainingStocks(allStocks, isForceRound);

        if (remaining.length === 0) {
            log(`✓ All ${allStocks.length} stocks have overviews. Done!`);
            break;
        }

        log(`\n── Round ${round}: ${remaining.length} stocks to go ──`);

        // Pre-compute metrics (best-effort — null is handled gracefully)
        process.stdout.write('  Computing metrics...');
        const mc = {};
        for (const s of remaining) {
            try { mc[s.symbol] = await metricsOrchestrator.getMetrics(s.symbol); }
            catch  { mc[s.symbol] = null; }
        }
        process.stdout.write(` done (${Object.keys(mc).length})\n`);

        let processedThisRound = 0;
        const totalBatches = Math.ceil(remaining.length / BATCH_SIZE);

        // ── Phase 1: Gemini ───────────────────────────────────────────────────
        if (GEMINI_KEY) {
            log(`  Phase 1 — Gemini (${totalBatches} batches × ${BATCH_SIZE})`);

            for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
                const batch = remaining.slice(i, i + BATCH_SIZE);
                const facts = batch.map(s => buildFact(s, mc[s.symbol]));
                const batchNum = Math.floor(i / BATCH_SIZE) + 1;

                // All models in cooldown — decide: wait (RPM) or bail to Copilot (daily quota)
                if (!pickModel()) {
                    if (allModelsOnQuotaCooldown()) {
                        log(`  ⚡ All Gemini models hit daily quota — switching to Copilot immediately`);
                        break; // skip remaining batches, go to Phase 2
                    }
                    const waitUntil = earliestCooldownEnd();
                    const waitMs    = Math.max(5_000, waitUntil - Date.now());
                    log(`  ⌛ RPM cooldown — waiting ${fmt(waitMs)} (until ${new Date(waitUntil).toLocaleTimeString()})`);
                    await sleep(waitMs + 2_000);
                }

                log(`  [${batchNum}/${totalBatches}] ${batch.map(s => s.symbol).join(' ')}`);
                const missed = await processGeminiBatch(batch, facts);
                processedThisRound += batch.length - missed.length;

                // Polite delay between calls (skip after last batch)
                if (i + BATCH_SIZE < remaining.length) {
                    await sleep(INTER_CALL_DELAY_MS);
                }
            }
        }

        // ── Phase 2: GitHub Copilot top-up ───────────────────────────────────
        // Runs immediately when Gemini hits daily quota mid-round,
        // or as normal top-up after Gemini finishes.
        if (useGH) {
            const remainingAfterGemini = await getRemainingStocks(allStocks, false);
            if (remainingAfterGemini.length > 0) {
                log(`  Phase 2 — GitHub Copilot (${remainingAfterGemini.length} stocks)`);
                let copilotFailed = [];
                for (let i = 0; i < remainingAfterGemini.length; i++) {
                    const s    = remainingAfterGemini[i];
                    const fact = buildFact(s, mc[s.symbol] || null);
                    const ok   = await processCopilot(s.symbol, fact);
                    if (ok) processedThisRound++;
                    else copilotFailed.push(s);
                    if (i < remainingAfterGemini.length - 1) await sleep(4_000);
                }

                // Phase 3: GitHub Models as final fallback for anything Copilot couldn't handle
                if (copilotFailed.length > 0) {
                    log(`  Phase 3 — GitHub Models fallback (${copilotFailed.length} stocks)`);
                    for (let i = 0; i < copilotFailed.length; i++) {
                        const s    = copilotFailed[i];
                        const fact = buildFact(s, mc[s.symbol] || null);
                        const ok   = await processGitHubModels(s.symbol, fact);
                        if (ok) processedThisRound++;
                        if (i < copilotFailed.length - 1) await sleep(4_000);
                    }
                }
            }
        }

        // ── Check progress ────────────────────────────────────────────────────
        const afterRound = await getRemainingStocks(allStocks, false);

        if (afterRound.length === 0) {
            log(`✓ All ${allStocks.length} stocks have overviews. Done!`);
            break;
        }

        if (processedThisRound === 0) {
            // No progress — all models must be cooling down
            const waitUntil = earliestCooldownEnd();
            const waitMs    = Math.max(RPM_COOLDOWN_MS, waitUntil - Date.now());
            log(`  ⏳ No progress this round. ${afterRound.length} stocks remain.`);
            log(`  Waiting ${fmt(waitMs)} before next attempt (cooldowns active)...`);
            log(`  Elapsed total: ${fmt(elapsed() * 1000)}`);
            await sleep(waitMs + 5_000);
        } else {
            log(`  Round ${round} done: +${processedThisRound} overviews (${afterRound.length} remaining, ${elapsed()}s total)`);
            // Brief pause between rounds before re-checking
            await sleep(2_000);
        }
    }

    // ── Market overview ───────────────────────────────────────────────────────
    await generateMarketOverview();

    // ── Final report ─────────────────────────────────────────────────────────
    const finalCount = await prisma.aIOverview.count({ where: { type: 'stock' } });
    const totalActive = allStocks.length;

    log('\n════════════════════ RESULTS ════════════════════');
    log(`Gemini OK  : ${stats.geminiOk}`);
    log(`Copilot OK : ${stats.copilotOk}`);
    log(`GH Mdls OK : ${stats.ghOk}`);
    log(`Failed     : ${stats.failed}`);
    log(`API calls  : ${stats.apiCalls}`);
    log(`Tokens     : ${stats.tokens.toLocaleString()}`);
    log(`Rate limits: ${stats.rateLimits}`);
    log(`Rounds     : ${stats.rounds}`);
    log(`Total time : ${fmt(elapsed() * 1000)}`);
    log(`Coverage   : ${finalCount}/${totalActive} stocks`);
    log('');
    GEMINI_MODELS.forEach(m => {
        const s = modelState[m];
        log(`  ${m}: ${s.totalOk} ok, ${s.totalRL} RL`);
    });

    if (finalCount < totalActive) {
        log(`\n⚠ ${totalActive - finalCount} stocks still have no overview.`);
        log('  Run again to retry (Gemini daily quota resets at ~00:05 UTC).');
    } else {
        log('\n✓ 100% coverage achieved.');
    }

    await prisma.$disconnect();
}

main().catch(async err => {
    console.error('\nFatal error:', err);
    await prisma.$disconnect();
    process.exit(1);
});
