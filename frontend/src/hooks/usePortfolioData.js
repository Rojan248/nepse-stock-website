import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { getPortfolios, createPortfolio, deletePortfolio, addTrade, deleteTrade, getPortfolioSummary } from '../services/api';

export function usePortfolioData() {
    const { user } = useAuth();
    const [portfolios, setPortfolios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const [holdings, setHoldings] = useState(null);
    const [error, setError] = useState('');
    const selectedIdRef = useRef(null);

    useEffect(() => {
        selectedIdRef.current = selectedId;
    }, [selectedId]);

    const loadPortfolios = useCallback(async (preferredId = selectedIdRef.current) => {
        try {
            const data = await getPortfolios();
            const list = Array.isArray(data) ? data : [];
            const nextSelected = list.some(p => p.id === preferredId)
                ? preferredId
                : (list[0]?.id ?? null);

            setPortfolios(list);
            setSelectedId(nextSelected);
            setError('');
            return list;
        } catch {
            setPortfolios([]);
            setSelectedId(null);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!user) {
            setPortfolios([]);
            setSelectedId(null);
            setHoldings(null);
            setLoading(false);
            return;
        }

        loadPortfolios();
    }, [user, loadPortfolios]);

    useEffect(() => {
        if (!selectedId) { setHoldings(null); return; }
        let cancelled = false;
        getPortfolioSummary(selectedId)
            .then(data => { if (!cancelled) setHoldings(data); })
            .catch(() => { if (!cancelled) setHoldings(null); });

        return () => { cancelled = true; };
    }, [selectedId, portfolios]);

    const handleCreate = async (name) => {
        if (!name.trim()) return;
        try {
            const p = await createPortfolio(name.trim());
            await loadPortfolios(p.id);
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Failed to create');
        }
    };

    const handleDelete = async (id) => {
        try {
            await deletePortfolio(id);
            await loadPortfolios(selectedId === id ? null : selectedId);
        } catch { setError('Failed to delete portfolio'); }
    };

    const handleAddTrade = async (tradeForm) => {
        setError('');
        if (!selectedId) return;
        const quantity = parseInt(tradeForm.quantity, 10);
        const price = parseFloat(tradeForm.price);
        const symbol = tradeForm.symbol.trim().toUpperCase();

        if (!symbol || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
            setError('Enter a valid symbol, quantity, and price');
            return false;
        }

        try {
            await addTrade(selectedId, {
                symbol,
                type: tradeForm.type,
                quantity,
                price,
                date: tradeForm.date
            });
            await loadPortfolios(selectedId);
            return true;
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Failed to add trade');
            return false;
        }
    };

    const handleDeleteTrade = async (tradeId) => {
        try {
            await deleteTrade(selectedId, tradeId);
            await loadPortfolios(selectedId);
        } catch { setError('Failed to delete trade'); }
    };

    const selected = portfolios.find(p => p.id === selectedId);

    return {
        portfolios, loading, selectedId, setSelectedId, holdings,
        error, selected, handleCreate, handleDelete, handleAddTrade, handleDeleteTrade
    };
}
