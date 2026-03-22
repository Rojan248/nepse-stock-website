/**
 * Market Narrative Generator
 * Extracted from narrativeHelpers.js
 */
const { fmtLakh } = require('./narrativeFormatters');

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

module.exports = {
    generateMarketNarrative
};
