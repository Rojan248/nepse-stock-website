const logger = require('../services/utils/logger');
const { prisma } = require('../services/database/connection');
const n = require('nepse-api-helper');
const { nepseAxios } = require('nepse-api-helper/dist/http');

async function fetchHistoricalData(dateStr, w) {
    const authRes = await nepseAxios.get(n.BASE_URL + '/api/authenticate/prove');
    const { salt1, salt2, salt3, salt4, salt5, accessToken } = authRes.data;
    
    const id = w.cdx(salt1, salt2, salt3, salt4, salt5);
    
    const headers = n.nepseClient.createHeaders(accessToken);
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    headers['Accept'] = 'application/json, text/plain, */*';
    headers['Accept-Language'] = 'en-US,en;q=0.9';
    headers['Origin'] = 'https://www.nepalstock.com.np';
    headers['Referer'] = 'https://www.nepalstock.com.np/today-price';
    headers['Sec-Fetch-Dest'] = 'empty';
    headers['Sec-Fetch-Mode'] = 'cors';
    headers['Sec-Fetch-Site'] = 'same-origin';
    
    const body = { id, businessDate: dateStr };
    
    const pRes = await nepseAxios.post(n.BASE_URL + '/api/nots/nepse-data/today-price?size=500', body, { headers });
    return pRes.data?.content || [];
}

const parseNum = (val) => parseFloat(val) || 0;

function createUpsertOperation(item, targetDate) {
    const data = {
        closePrice: parseNum(item.closePrice),
        openPrice: parseNum(item.openPrice),
        highPrice: parseNum(item.highPrice),
        lowPrice: parseNum(item.lowPrice),
        volume: parseNum(item.totalTradedQuantity),
        turnover: parseNum(item.totalTradedValue),
        change: parseNum(item.pointChange),
        percentageChange: parseNum(item.percentageChange)
    };
    
    return prisma.marketHistory.upsert({
        where: { symbol_date: { symbol: item.symbol, date: targetDate } },
        update: data,
        create: { symbol: item.symbol, date: targetDate, ...data }
    });
}

async function scrapeBack(days = 30) {
    logger.info(`Starting to scrape the last ${days} days of NEPSE history from official site...`);
    
    await n.nepseClient.initialize({ useWasm: true });
    const w = await n.loadWasmModule();

    for (let i = 0; i <= days; i++) {
        let targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - i);
        
        if (targetDate.getDay() === 5 || targetDate.getDay() === 6) continue;

        const dateStr = targetDate.toISOString().split('T')[0];
        logger.info(`Fetching data for ${dateStr}...`);

        try {
            const content = await fetchHistoricalData(dateStr, w);
            
            if (content.length > 0) {
                logger.info(`Found ${content.length} records. Upserting to Database...`);
                const ops = content.map(item => createUpsertOperation(item, targetDate));
                await prisma.$transaction(ops);
            } else {
                logger.info(`No trading data found for ${dateStr} (likely a holiday).`);
            }
            
        } catch (error) {
            logger.error(`Failed on ${dateStr}: ${error.message}`);
        }
        
        // Wait 2 seconds to not spam the official NEPSE server
        await new Promise(r => setTimeout(r, 2000));
    }
    
    logger.info('Backfill complete!');
}

scrapeBack(30).then(() => process.exit(0)).catch(e => { logger.error(e); process.exit(1); });
