const { prisma } = require('./database/connection');
const { Decimal } = require('@prisma/client').Prisma;

function processBuyTrade(h, qty, price) {
    h.totalInvested = h.totalInvested.plus(qty.times(price));
    h.quantity = h.quantity.plus(qty);
}

function processSellTrade(h, qty, price) {
    const avgCost = h.quantity.gt(0) ? h.totalInvested.dividedBy(h.quantity) : new Decimal(0);
    const sellQty = Decimal.min(qty, h.quantity);
    h.totalInvested = h.totalInvested.minus(sellQty.times(avgCost));
    h.quantity = h.quantity.minus(sellQty);
}

function aggregateTradesToHoldings(portfolios) {
    const holdingsMap = {};
    for (const portfolio of portfolios) {
        for (const trade of portfolio.trades) {
            const sym = trade.symbol;
            if (!holdingsMap[sym]) {
                holdingsMap[sym] = { symbol: sym, quantity: new Decimal(0), totalInvested: new Decimal(0) };
            }

            const h = holdingsMap[sym];
            const qty = new Decimal(trade.quantity);
            const price = new Decimal(trade.price);

            if (trade.type === 'buy') processBuyTrade(h, qty, price);
            else if (trade.type === 'sell') processSellTrade(h, qty, price);
        }
    }
    return holdingsMap;
}

async function fetchLivePrices(activeSymbols) {
    let priceMap = {};
    if (activeSymbols.length > 0) {
        const stocks = await prisma.stock.findMany({
            where: { symbol: { in: activeSymbols } },
            select: { symbol: true, lastTradedPrice: true }
        });
        for (const s of stocks) {
            priceMap[s.symbol] = s.lastTradedPrice ? new Decimal(s.lastTradedPrice) : new Decimal(0);
        }
    }
    return priceMap;
}

function calculateStockPnLs(activeSymbols, holdingsMap, priceMap) {
    let aggregateInvested = new Decimal(0);
    let aggregateCurrentValue = new Decimal(0);

    const holdings = activeSymbols.map(sym => {
        const h = holdingsMap[sym];
        const currentPrice = priceMap[sym] || new Decimal(0);

        const avgBuyPrice = h.quantity.gt(0) ? h.totalInvested.dividedBy(h.quantity) : new Decimal(0);
        const currentValue = h.quantity.times(currentPrice);
        const unrealizedPnL = currentValue.minus(h.totalInvested);
        const pnlPercentage = h.totalInvested.gt(0) ? unrealizedPnL.dividedBy(h.totalInvested).times(100) : new Decimal(0);

        aggregateInvested = aggregateInvested.plus(h.totalInvested);
        aggregateCurrentValue = aggregateCurrentValue.plus(currentValue);

        return {
            symbol: sym,
            sharesHeld: h.quantity.toNumber(),
            averageBuyPrice: avgBuyPrice.toNumber(),
            currentPrice: currentPrice.toNumber(),
            investedAmount: h.totalInvested.toNumber(),
            currentValue: currentValue.toNumber(),
            unrealizedPnL: unrealizedPnL.toNumber(),
            pnlPercentage: pnlPercentage.toNumber()
        };
    });

    return { holdings, aggregateInvested, aggregateCurrentValue };
}

/**
 * Calculates the detailed P&L for a user's portfolio(s).
 * If portfolioId is provided, calculates for that specific portfolio.
 * If portfolioId is null, aggregates all portfolios for the user.
 *
 * @param {number} userId - The ID of the user.
 * @param {number|null} portfolioId - Optional specific portfolio ID.
 * @returns {Object} P&L breakdown
 */
const calculatePortfolioPnL = async (userId, portfolioId = null) => {
    // 1. Fetch relevant portfolios and trades
    const whereClause = { userId };
    if (portfolioId) {
        whereClause.id = portfolioId;
    }

    const portfolios = await prisma.portfolio.findMany({
        where: whereClause,
        include: {
            trades: {
                orderBy: { date: 'asc' }
            }
        }
    });

    if (!portfolios || portfolios.length === 0) {
        return {
            holdings: [],
            summary: {
                totalInvested: 0,
                totalCurrentValue: 0,
                totalPnL: 0,
                pnlPercentage: 0
            }
        };
    }

    // 2. Aggregate trades into holdings
    const holdingsMap = aggregateTradesToHoldings(portfolios);

    // Filter out completely sold off holdings with 0 quantity
    const activeSymbols = Object.keys(holdingsMap).filter(sym => holdingsMap[sym].quantity.gt(0));

    // 3. Fetch live market prices
    let priceMap = await fetchLivePrices(activeSymbols);

    // 4. Calculate P&L for each stock
    const { holdings, aggregateInvested, aggregateCurrentValue } = calculateStockPnLs(activeSymbols, holdingsMap, priceMap);

    // 5. Calculate global aggregates
    const totalPnL = aggregateCurrentValue.minus(aggregateInvested);
    const globalPnlPercentage = aggregateInvested.gt(0)
        ? totalPnL.dividedBy(aggregateInvested).times(100)
        : new Decimal(0);

    return {
        holdings,
        summary: {
            totalInvested: aggregateInvested.toNumber(),
            totalCurrentValue: aggregateCurrentValue.toNumber(),
            totalPnL: totalPnL.toNumber(),
            pnlPercentage: globalPnlPercentage.toNumber()
        }
    };
};

module.exports = {
    calculatePortfolioPnL
};
