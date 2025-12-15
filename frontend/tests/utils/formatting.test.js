import { describe, it, expect } from 'vitest';
import {
    formatPrice,
    formatPercent,
    formatNumber,
    formatDate,
    formatTimestamp,
    getChangeClass,
    formatTurnover
} from '../../src/utils/formatting';

describe('Formatting Utilities', () => {
    describe('formatPrice', () => {
        it('should format currency correctly', () => {
            expect(formatPrice(1234.56)).toContain('1,234.56');
        });

        it('should add Nepali Rupee symbol', () => {
            expect(formatPrice(100)).toContain('₨');
        });

        it('should show decimal places', () => {
            expect(formatPrice(100)).toContain('.00');
        });

        it('should handle null/undefined', () => {
            expect(formatPrice(null)).toBe('₨0.00');
            expect(formatPrice(undefined)).toBe('₨0.00');
        });
    });

    describe('formatPercent', () => {
        it('should add % sign', () => {
            expect(formatPercent(5.32)).toContain('%');
        });

        it('should show + for positive', () => {
            expect(formatPercent(5)).toContain('+');
        });

        it('should show - for negative', () => {
            expect(formatPercent(-5)).not.toContain('+');
            expect(formatPercent(-5)).toContain('-');
        });

        it('should handle zero', () => {
            expect(formatPercent(0)).toBe('+0.00%');
        });
    });

    describe('formatNumber', () => {
        it('should add commas', () => {
            expect(formatNumber(1000000)).toContain(',');
        });

        it('should handle null/undefined', () => {
            expect(formatNumber(null)).toBe('0');
        });
    });

    describe('formatDate', () => {
        it('should convert ISO to readable', () => {
            const result = formatDate('2024-12-11T10:00:00Z');
            expect(result).toContain('Dec');
            expect(result).toContain('2024');
        });

        it('should return N/A for invalid date', () => {
            expect(formatDate(null)).toBe('N/A');
        });
    });

    describe('formatTimestamp', () => {
        it('should return "Just now" for recent', () => {
            const now = new Date();
            expect(formatTimestamp(now.toISOString())).toBe('Just now');
        });

        it('should return minutes ago', () => {
            const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
            expect(formatTimestamp(fiveMinAgo.toISOString())).toContain('minute');
        });
    });

    describe('getChangeClass', () => {
        it('should return price-up for positive', () => {
            expect(getChangeClass(5)).toBe('price-up');
        });

        it('should return price-down for negative', () => {
            expect(getChangeClass(-5)).toBe('price-down');
        });

        it('should return price-unchanged for zero', () => {
            expect(getChangeClass(0)).toBe('price-unchanged');
        });
    });

    describe('formatTurnover', () => {
        it('should format in crores', () => {
            expect(formatTurnover(100000000)).toContain('Cr');
        });

        it('should format in lakhs', () => {
            expect(formatTurnover(1000000)).toContain('L');
        });
    });
});
