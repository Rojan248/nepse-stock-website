import { renderHook, act, waitFor } from '@testing-library/react';
import { useLiveData } from '../../src/hooks/useLiveData';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useLiveData', () => {

    it('should detect changes correctly', async () => {
        const mockData1 = {
            id: 1,
            value: 100,
            nested: { prop: 'a' },
            list: [{ id: 1, val: 10 }]
        };
        const mockData2 = {
            id: 1,
            value: 200, // Changed
            nested: { prop: 'a' }, // Same
            list: [{ id: 1, val: 20 }] // Changed deep
        };

        const fetchFn = vi.fn()
            .mockResolvedValueOnce(mockData1)
            .mockResolvedValueOnce(mockData2);

        // Enable polling initially to get first data
        const { result } = renderHook(() => useLiveData(fetchFn, 5000, true));

        // Initial fetch is triggered by useEffect on mount
        await waitFor(() => {
            if (!result.current.data) throw new Error('Data not loaded');
            expect(result.current.data).toEqual(mockData1);
        }, { timeout: 1000 });

        // Trigger refresh manually to get second data
        await act(async () => {
             result.current.refresh();
        });

        // Wait for data2
        await waitFor(() => {
            expect(result.current.data).toEqual(mockData2);
        }, { timeout: 1000 });

        const changes = result.current.changedFields;
        // console.log('Changes:', Array.from(changes));

        expect(changes.has('value')).toBe(true);
        expect(changes.has('list.1.val')).toBe(true);
        expect(changes.has('nested.prop')).toBe(false);
    });
});
