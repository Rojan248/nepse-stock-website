const { performance } = require('perf_hooks');

// Mock data
const trending = [
    { symbol: 'AAPL', score: 100 },
    { symbol: 'GOOGL', score: 90 },
    { symbol: 'MSFT', score: 80 },
    { symbol: 'AMZN', score: 70 },
    { symbol: 'TSLA', score: 60 },
    { symbol: 'META', score: 50 },
    { symbol: 'NFLX', score: 40 },
    { symbol: 'NVDA', score: 30 },
    { symbol: 'AMD', score: 20 },
    { symbol: 'INTC', score: 10 }
];

// Simulate DB latency
const DB_LATENCY_MS = 20;

const mockStockData = (symbol) => ({
    symbol,
    companyName: `${symbol} Inc.`,
    ltp: 150.00,
    changePercent: 1.5
});

// Current Implementation: N+1 queries
const getStockBySymbol = async (symbol) => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(mockStockData(symbol));
        }, DB_LATENCY_MS);
    });
};

const currentImplementation = async () => {
    const start = performance.now();
    const result = await Promise.all(
        trending.map(async (item) => {
            const stock = await getStockBySymbol(item.symbol);
            if (!stock) return null;
            return {
                symbol: item.symbol,
                name: stock.companyName,
                score: item.score,
                change: stock.changePercent,
                ltp: stock.ltp
            };
        })
    );
    const end = performance.now();
    return { time: end - start, result: result.filter(r => r !== null) };
};

// Optimized Implementation: Batch query
const getStocksBySymbols = async (symbols) => {
    return new Promise(resolve => {
        setTimeout(() => {
            const stocks = symbols.map(s => mockStockData(s));
            resolve(stocks);
        }, DB_LATENCY_MS); // Same latency for one batch query
    });
};

const optimizedImplementation = async () => {
    const start = performance.now();

    // Extract symbols
    const symbols = trending.map(t => t.symbol);

    // Batch fetch
    const stocks = await getStocksBySymbols(symbols);

    // Map for O(1) lookup
    const stockMap = new Map(stocks.map(s => [s.symbol, s]));

    const result = trending.map(item => {
        const stock = stockMap.get(item.symbol);
        if (!stock) return null;
        return {
            symbol: item.symbol,
            name: stock.companyName,
            score: item.score,
            change: stock.changePercent,
            ltp: stock.ltp
        };
    }).filter(r => r !== null);

    const end = performance.now();
    return { time: end - start, result };
};

const runBenchmark = async () => {
    console.log('Running benchmark...');
    console.log(`Simulated DB Latency: ${DB_LATENCY_MS}ms`);
    console.log(`Number of items: ${trending.length}`);

    const current = await currentImplementation();
    console.log(`Current (N+1) Time: ${current.time.toFixed(2)}ms`);

    const optimized = await optimizedImplementation();
    console.log(`Optimized (Batch) Time: ${optimized.time.toFixed(2)}ms`);

    const improvement = ((current.time - optimized.time) / current.time) * 100;
    console.log(`Improvement: ${improvement.toFixed(2)}%`);
};

runBenchmark();
