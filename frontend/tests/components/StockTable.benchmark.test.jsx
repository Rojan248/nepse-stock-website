import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import StockTable from '../../src/components/StockTable';
import { BrowserRouter } from 'react-router-dom';

const mockStocks = Array.from({ length: 10 }, (_, i) => ({
    symbol: `STOCK${i}`,
    ltp: 100 + i,
    change: 10,
    changePercent: 1,
    volume: 1000,
    companyName: `Company ${i}`,
    sector: 'Banking'
}));

const mockMatchMedia = (matches) => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: matches,
            media: query,
            onchange: null,
            addListener: vi.fn(), // Deprecated
            removeListener: vi.fn(), // Deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
};

describe('StockTable Benchmark', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('renders ONLY desktop view when not mobile', () => {
        mockMatchMedia(false); // Desktop

        render(
            <BrowserRouter>
                <StockTable stocks={mockStocks} />
            </BrowserRouter>
        );

        // Check for desktop rows
        const rows = document.querySelectorAll('.stock-table tbody tr');
        expect(rows.length).toBe(10);

        // Check for mobile cards - should be 0 now
        const cards = document.querySelectorAll('.stock-card');
        expect(cards.length).toBe(0);

        console.log(`Desktop View: Rendered ${rows.length} rows and ${cards.length} cards.`);
    });

    it('renders ONLY mobile view when mobile', () => {
        mockMatchMedia(true); // Mobile

        render(
            <BrowserRouter>
                <StockTable stocks={mockStocks} />
            </BrowserRouter>
        );

        // Check for desktop rows - should be 0
        const rows = document.querySelectorAll('.stock-table tbody tr');
        expect(rows.length).toBe(0);

        // Check for mobile cards
        const cards = document.querySelectorAll('.stock-card');
        expect(cards.length).toBe(10);

        console.log(`Mobile View: Rendered ${rows.length} rows and ${cards.length} cards.`);
    });
});
