const {
    extractTransactionFromHTML,
    hasValidMarketMeta,
    parseMarketMetaResponse
} = require('../../src/services/utils/marketDataHelpers');

describe('marketDataHelpers', () => {
    describe('extractTransactionFromHTML', () => {
        it('extracts totals from a strict "Total Transactions" match', () => {
            const html = '<tr><th>Total Transactions</th><td>59,805</td></tr>';
            const result = extractTransactionFromHTML(html);

            expect(result).toEqual({ totalTransactions: 59805, totalTurnover: null, totalVolume: null });
        });

        it('returns null when the page has no "Total Transactions" section (weekend layout)', () => {
            // Regression: Merolagani serves this shape on non-trading days.
            // The old loose fallback matched the stray "21" and reported it as a real total.
            const html = `
                <div class="marketstatus">
                    <span>Top Gainers</span><span class="indices-value">21</span>
                    <p>No live market data. Market is closed today.</p>
                    <script>var lastUpdate = 'transactions pending';</script>
                </div>`;

            expect(extractTransactionFromHTML(html)).toBeNull();
        });

        it('rejects implausibly low transaction counts', () => {
            const html = '<tr><th>Total Transactions</th><td>21</td></tr>';

            expect(extractTransactionFromHTML(html)).toBeNull();
        });

        it('accepts small counts when the caller lowers the floor for pre-open', () => {
            const html = '<tr><th>Total Transactions</th><td>42</td></tr>';

            const result = extractTransactionFromHTML(html, () => { }, 10);

            expect(result).toEqual({ totalTransactions: 42, totalTurnover: null, totalVolume: null });
        });
    });

    describe('hasValidMarketMeta', () => {
        it('is true when any field is present', () => {
            expect(hasValidMarketMeta(null, 100, null)).toBe(true);
            expect(hasValidMarketMeta(10, null, null)).toBe(true);
        });

        it('is false when all fields are missing', () => {
            expect(hasValidMarketMeta(null, null, null)).toBe(false);
        });
    });

    describe('parseMarketMetaResponse', () => {
        it('reads NEPSE market-open fields with fallbacks', () => {
            const resp = { data: { totalTransaction: '123', totalTurnover: '4.5', totalVolume: '9' } };
            expect(parseMarketMetaResponse(resp)).toEqual({
                totalTransactions: 123,
                totalTurnover: 4.5,
                totalVolume: 9
            });
        });

        it('yields nulls for an empty body', () => {
            expect(parseMarketMetaResponse({})).toEqual({
                totalTransactions: null,
                totalTurnover: null,
                totalVolume: null
            });
        });
    });
});
