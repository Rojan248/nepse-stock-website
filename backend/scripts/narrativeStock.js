/**
 * Stock Narrative Generator
 * Extracted from narrativeHelpers.js
 */
const { fmtLakh, fmtNPR, pctWord } = require('./narrativeFormatters');

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
    generateStockNarrative
};
