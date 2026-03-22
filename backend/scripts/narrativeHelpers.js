/**
 * Narrative Generation Helpers
 * Pure functions that generate human-readable narrative text from stock/market data.
 * Extracted from manualAIUpdate.js to reduce per-file complexity.
 */

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtNPR(val) {
  if (val == null || isNaN(val)) return 'N/A';
  return `NPR ${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtLakh(val) {
  if (val == null || isNaN(val)) return 'N/A';
  const num = Number(val);
  const abs = Math.abs(num);
  if (abs >= 10000000) return `${(num / 10000000).toFixed(2)} crore`;
  if (abs >= 100000) return `${(num / 100000).toFixed(2)} lakh`;
  return num.toLocaleString('en-IN');
}

function pctWord(pct) {
  const abs = Math.abs(pct);
  if (abs >= 5) return 'significantly';
  if (abs >= 2) return 'noticeably';
  if (abs >= 0.5) return 'slightly';
  return 'barely';
}

// ── Market Narrative ──────────────────────────────────────────────────────────

function getMarketSummaryText({ chgPct, chg, direction, dirWord, idx, totalTraded, adv, dec }) {
  if (chgPct >= 2) return `Today was a very strong day for the NEPSE market. The index surged ${direction} by ${Math.abs(chg).toFixed(2)} points (${Math.abs(chgPct).toFixed(2)}%), closing at ${idx.toFixed(2)}. Out of ${totalTraded} stocks that were traded, ${adv} went ${direction === 'up' ? 'up' : 'down'} and only ${dec} moved the other way — a very ${dirWord} session overall.`;
  if (chgPct >= 0.5) return `The NEPSE market had a ${dirWord} day today. The index moved ${direction} by ${Math.abs(chg).toFixed(2)} points (${Math.abs(chgPct).toFixed(2)}%), settling at ${idx.toFixed(2)}. ${adv} stocks advanced while ${dec} declined out of ${totalTraded} traded stocks.`;
  if (chgPct >= 0) return `The market had a relatively quiet day. The NEPSE index edged ${direction} by ${Math.abs(chg).toFixed(2)} points (${Math.abs(chgPct).toFixed(2)}%) to close at ${idx.toFixed(2)}. ${adv} stocks gained while ${dec} dropped.`;
  return `The NEPSE market had a ${dirWord} session today. The index fell by ${Math.abs(chg).toFixed(2)} points (${Math.abs(chgPct).toFixed(2)}%) to close at ${idx.toFixed(2)}. ${dec} stocks declined while ${adv} managed to advance.`;
}

function getMarketBullets({ turnover, volume, adv, dec, totalTraded, sectors }) {
  const bullets = [`The total value of shares traded today was about NPR ${fmtLakh(turnover)}, with around ${fmtLakh(volume)} shares changing hands.`];
  
  if (adv > dec * 5) bullets.push(`${adv} out of ${totalTraded} stocks went up today, while only ${dec} lost value — a very strong day across the board.`);
  else if (adv > dec) bullets.push(`More stocks went up (${adv}) than went down (${dec}) today, showing overall positive market mood.`);
  else bullets.push(`More stocks went down (${dec}) than went up (${adv}) today, showing overall cautious market mood.`);

  const topSectors = sectors.slice(0, 3);
  if (topSectors.length >= 2) {
    const sectorNames = topSectors.map(s => s.name).join(' and ');
    bullets.push(`The ${sectorNames} sectors did especially well, meaning companies in those areas saw the biggest price increases.`);
  }

  if (dec <= 10) bullets.push(`Only ${dec} stocks dropped in price today, showing that almost every company on the market had a positive day.`);
  else if (dec > adv) bullets.push(`${dec} stocks lost value today, more than the ${adv} that gained, suggesting some selling pressure in the market.`);

  return bullets;
}

function getMarketOutlook(chgPct, adv, dec) {
  if (chgPct >= 2 && adv > dec * 5) return `The market had a very strong day with nearly every stock gaining value. This kind of broad positive movement usually means investors are feeling confident about the overall economy.`;
  if (chgPct >= 0.5) return `The market showed steady positive movement today. The healthy balance of advancing stocks suggests continued investor confidence.`;
  if (chgPct >= 0) return `The market was relatively stable today with mild gains. This suggests a wait-and-watch approach from most investors.`;
  return `The market saw some selling pressure today. Investors may be taking a cautious approach, but single-day declines are normal and not necessarily a sign of trouble.`;
}

function generateMarketNarrative(summary, sectors) {
  const { indexValue: idx, indexChange: chg, indexChangePercent: chgPct, advancedCompanies: adv, declinedCompanies: dec, unchangedCompanies: unch, totalTurnover: turnover, totalVolume: volume } = summary;
  const totalTraded = adv + dec + unch;
  const direction = chg >= 0 ? 'up' : 'down';
  const dirWord = chg >= 0 ? 'positive' : 'negative';

  return {
    summary: getMarketSummaryText({ chgPct, chg, direction, dirWord, idx, totalTraded, adv, dec }),
    bullets: getMarketBullets({ turnover, volume, adv, dec, totalTraded, sectors }),
    outlook: getMarketOutlook(chgPct, adv, dec)
  };
}

// ── Stock Narrative ───────────────────────────────────────────────────────────

function getStockSummaryText({ changePct, name, symbol, absChgPct, ltp, sector }) {
  if (changePct >= 3) return `${name} (${symbol}) had a very strong day, with its share price climbing ${absChgPct}% to reach ${fmtNPR(ltp)}. The stock is in the ${sector} sector and saw solid buying interest today.`;
  if (changePct >= 0.5) return `${name} (${symbol}) ended the day with a ${pctWord(changePct)} rise of ${absChgPct}%, closing at ${fmtNPR(ltp)}. This ${sector} sector stock had a positive trading session.`;
  if (changePct > -0.5) return `${name} (${symbol}) closed at ${fmtNPR(ltp)}, with a ${changePct >= 0 ? 'marginal gain' : 'slight dip'} of ${absChgPct}%. The stock in the ${sector} sector had a quiet day.`;
  if (changePct > -3) return `${name} (${symbol}) saw a decline of ${absChgPct}% today, closing at ${fmtNPR(ltp)}. The ${sector} sector stock faced some selling pressure.`;
  return `${name} (${symbol}) dropped ${absChgPct}% to close at ${fmtNPR(ltp)}. The ${sector} sector stock had a difficult session with notable selling.`;
}

function appendStockVolume(bullets, volume, turnover) {
  if (volume > 0) bullets.push(`Around ${fmtLakh(volume)} shares were traded today${turnover > 0 ? `, worth about NPR ${fmtLakh(turnover)} in total` : ''}.`);
}

function appendStockRange(bullets, high, low) {
  const isHighLowValid = Boolean(high && low && high !== low);
  if (isHighLowValid) bullets.push(`Today's price ranged between ${fmtNPR(low)} and ${fmtNPR(high)}.`);
}

function append52wRange(bullets, ltp, w52High, w52Low) {
  if (!w52High || !w52Low) return;
  const range = w52High - w52Low;
  const position = range > 0 ? ((ltp - w52Low) / range * 100).toFixed(0) : 50;
  if (position > 80) bullets.push(`The stock is trading near its highest price in the past year (${fmtNPR(w52High)}).`);
  else if (position < 20) bullets.push(`The stock is trading near its lowest price in the past year (${fmtNPR(w52Low)}).`);
  else bullets.push(`Over the past year, the stock has ranged from ${fmtNPR(w52Low)} to ${fmtNPR(w52High)}.`);
}

function getStockBullets({ ltp, change, prevClose, volume, turnover, high, low, w52High, w52Low }) {
  const direction = change >= 0 ? 'up' : 'down';
  const bullets = [`The stock closed at ${fmtNPR(ltp)}, which is ${fmtNPR(Math.abs(change))} ${direction} from yesterday's close of ${fmtNPR(prevClose)}.`];
  appendStockVolume(bullets, volume, turnover);
  appendStockRange(bullets, high, low);
  append52wRange(bullets, ltp, w52High, w52Low);
  return bullets;
}

function getStockOutlook(changePct) {
  if (changePct >= 3) return `The stock showed very strong momentum today. If this buying interest continues, the price could keep climbing, but sharp rises can sometimes be followed by a pause.`;
  if (changePct >= 0.5) return `The stock is showing positive movement. Steady gains like this often reflect growing investor interest in the company.`;
  if (changePct > -0.5) return `The stock had a mostly flat day, which could mean investors are waiting for new information before making big moves.`;
  if (changePct > -3) return `The stock faced some pressure today. This could be a temporary dip, but keeping an eye on the next few days would be wise.`;
  return `The stock had a tough day with significant selling. While one bad day doesn't define a trend, it's worth being cautious and watching for recovery signs.`;
}

function resolveStockPrice(stock) {
  return stock.lastTradedPrice || stock.ltp;
}

function resolveStockChange(stock, ltp) {
  if (stock.change != null) return stock.change;
  return ltp - stock.previousClose;
}

function resolveChangePct(stock, change, prevClose) {
  if (stock.percentageChange != null) return stock.percentageChange;
  if (stock.changePercent != null) return stock.changePercent;
  if (prevClose) return (change / prevClose) * 100;
  return 0;
}

function generateStockNarrative(stock) {
  const ltp = resolveStockPrice(stock);
  const prevClose = stock.previousClose;
  const change = resolveStockChange(stock, ltp);
  const changePct = resolveChangePct(stock, change, prevClose);
  const volume = stock.volume || stock.totalTradeQuantity || 0;
  
  const ctx = {
    absChgPct: Math.abs(changePct).toFixed(2),
    name: stock.companyName || stock.symbol,
    sector: stock.sector || 'N/A'
  };

  return {
    summary: getStockSummaryText({ changePct, name: ctx.name, symbol: stock.symbol, absChgPct: ctx.absChgPct, ltp, sector: ctx.sector }),
    bullets: getStockBullets({ ltp, change, prevClose, volume, turnover: stock.turnover || 0, high: stock.highPrice || stock.high, low: stock.lowPrice || stock.low, w52High: stock.fiftyTwoWeekHigh, w52Low: stock.fiftyTwoWeekLow }),
    outlook: getStockOutlook(changePct)
  };
}

module.exports = {
  generateMarketNarrative,
  generateStockNarrative,
  calculateSectors: function(stocks) {
    const sectorMap = {};
    for (const s of stocks) {
      if (!s.sector) continue;
      if (!sectorMap[s.sector]) sectorMap[s.sector] = { name: s.sector, count: 0, advancing: 0, declining: 0, totalChange: 0 };
      sectorMap[s.sector].count++;
      const pct = s.percentageChange || s.changePercent || 0;
      sectorMap[s.sector].totalChange += pct;
      if (pct > 0) sectorMap[s.sector].advancing++;
      else if (pct < 0) sectorMap[s.sector].declining++;
    }
    return Object.values(sectorMap)
      .map(s => ({ ...s, avgChange: s.totalChange / s.count }))
      .sort((a, b) => b.avgChange - a.avgChange);
  }
};
