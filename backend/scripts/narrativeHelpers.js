/**
 * Narrative Generation Helpers
 * Extracted pure functions into narrativeMarket.js and narrativeStock.js
 * to reduce per-file complexity.
 */

const { generateMarketNarrative } = require('./narrativeMarket');
const { generateStockNarrative } = require('./narrativeStock');

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
