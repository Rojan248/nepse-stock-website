import { useState, useEffect } from 'react';
import { getMarketOverview } from '../services/api';
import { Sparkles } from 'lucide-react';
import './MarketNarrativeBanner.css';

/**
 * Market Narrative Banner
 * Displays AI-generated market overview on the home page
 * Renders nothing if no data is available (graceful degradation)
 */
function MarketNarrativeBanner() {
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const fetchOverview = async () => {
            try {
                const data = await getMarketOverview();
                if (!cancelled && data?.narrative) {
                    setOverview(data);
                }
            } catch {
                // Fail silently
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchOverview();
        return () => { cancelled = true; };
    }, []);

    // Don't render if no data available
    if (!loading && !overview) return null;
    if (loading) return null; // Don't show skeleton for market banner

    const { narrative, generatedAt } = overview;

    return (
        <section className={`market-narrative ${collapsed ? 'market-narrative--collapsed' : ''}`}>
            <div className="market-narrative__header" onClick={() => setCollapsed(!collapsed)}>
                <div className="market-narrative__title">
                    <Sparkles size={16} className="market-narrative__icon" />
                    <span>Market Overview</span>
                    <span className="market-narrative__badge">AI</span>
                </div>
                <button className="market-narrative__toggle" aria-label="Toggle">
                    {collapsed ? '▼' : '▲'}
                </button>
            </div>

            {!collapsed && (
                <div className="market-narrative__content">
                    {narrative.summary && (
                        <p className="market-narrative__summary">{narrative.summary}</p>
                    )}

                    {narrative.bullets && narrative.bullets.length > 0 && (
                        <ul className="market-narrative__bullets">
                            {narrative.bullets.map((bullet, i) => (
                                <li key={i}>{bullet}</li>
                            ))}
                        </ul>
                    )}

                    {narrative.outlook && (
                        <p className="market-narrative__outlook">
                            <strong>Outlook:</strong> {narrative.outlook}
                        </p>
                    )}

                    <div className="market-narrative__footer">
                        <span>
                            {generatedAt ? `Updated ${new Date(generatedAt).toLocaleString()}` : 'Recently generated'}
                        </span>
                        <span className="market-narrative__disclaimer">
                            AI-generated · Not financial advice
                        </span>
                    </div>
                </div>
            )}
        </section>
    );
}

export default MarketNarrativeBanner;
