import { useState, useEffect } from 'react';
import { getStockOverview } from '../services/api';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import './AIOverviewCard.css';

/**
 * AI Overview Card
 * Displays AI-generated narrative for a stock
 * Works gracefully when no AI data is available
 */
function AIOverviewCard({ symbol }) {
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!symbol) return;
        let cancelled = false;

        const fetchOverview = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getStockOverview(symbol);
                if (!cancelled) {
                    setOverview(data);
                }
            } catch (err) {
                if (!cancelled) {
                    setError('AI overview not available');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchOverview();
        return () => { cancelled = true; };
    }, [symbol]);

    // Don't render anything if no data and not loading
    if (!loading && !overview && !error) return null;

    if (loading) {
        return (
            <section className="ai-overview ai-overview--loading">
                <div className="ai-overview__header">
                    <Sparkles size={18} />
                    <h3>AI Analysis</h3>
                </div>
                <div className="ai-overview__skeleton">
                    <div className="skeleton-line skeleton-line--full" />
                    <div className="skeleton-line skeleton-line--80" />
                    <div className="skeleton-line skeleton-line--60" />
                </div>
            </section>
        );
    }

    if (error || !overview?.narrative) {
        return null; // Fail silently — feature is optional
    }

    const { narrative, generatedAt, modelVersion } = overview;

    return (
        <section className="ai-overview sdp-animate-fade-in">
            <div className="ai-overview__header">
                <Sparkles size={18} className="ai-overview__icon" />
                <h3>AI Analysis</h3>
                <span className="ai-overview__badge">Beta</span>
            </div>

            {narrative.summary && (
                <p className="ai-overview__summary">{narrative.summary}</p>
            )}

            {narrative.bullets && narrative.bullets.length > 0 && (
                <ul className="ai-overview__bullets">
                    {narrative.bullets.map((bullet, i) => (
                        <li key={i}>{bullet}</li>
                    ))}
                </ul>
            )}

            {narrative.outlook && (
                <div className="ai-overview__outlook">
                    <strong>Outlook:</strong> {narrative.outlook}
                </div>
            )}

            <div className="ai-overview__footer">
                <span className="ai-overview__timestamp">
                    Generated {generatedAt ? new Date(generatedAt).toLocaleDateString() : 'recently'}
                </span>
                {modelVersion && (
                    <span className="ai-overview__model">{modelVersion}</span>
                )}
                <span className="ai-overview__disclaimer">
                    AI-generated analysis. Not financial advice.
                </span>
            </div>
        </section>
    );
}

export default AIOverviewCard;
