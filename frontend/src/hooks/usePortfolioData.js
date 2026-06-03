import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { getPortfolios, createPortfolio, deletePortfolio, addTrade, deleteTrade, getPortfolioSummary } from '../services/api';

const emptyPortfolioState = {
    portfolios: [],
    selectedId: null,
    holdings: null
};

const resolvePortfolioList = (data) => Array.isArray(data) ? data : [];

const resolveSelectedPortfolioId = (list, preferredId) =>
    list.some(p => p.id === preferredId) ? preferredId : (list[0]?.id ?? null);

const parseTradeForm = (tradeForm) => ({
    symbol: tradeForm.symbol.trim().toUpperCase(),
    type: tradeForm.type,
    quantity: parseInt(tradeForm.quantity, 10),
    price: parseFloat(tradeForm.price),
    date: tradeForm.date
});

const isPositiveNumber = (value) => Number.isFinite(value) && value > 0;

const isValidTrade = ({ symbol, quantity, price }) =>
    Boolean(symbol) && isPositiveNumber(quantity) && isPositiveNumber(price);

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
            const list = resolvePortfolioList(data);
            const nextSelected = resolveSelectedPortfolioId(list, preferredId);

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
            setPortfolios(emptyPortfolioState.portfolios);
            setSelectedId(emptyPortfolioState.selectedId);
            setHoldings(emptyPortfolioState.holdings);
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
        const trade = parseTradeForm(tradeForm);

        if (!isValidTrade(trade)) {
            setError('Enter a valid symbol, quantity, and price');
            return false;
        }

        try {
            await addTrade(selectedId, trade);
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
