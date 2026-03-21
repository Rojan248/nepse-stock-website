import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAIStockPicks } from '../services/api';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { TrendingUp, Sparkles, ChevronRight, BarChart3, Zap } from 'lucide-react';
import './AIPicks.css';

/** Map 0-100 score to a tier label + CSS class */
function getScoreTier(score) {
    if (score >= 75) return { label: 'Strong', cls: 'score-strong' };
    if (score >= 60) return { label: 'Good', cls: 'score-good' };
    if (score >= 45) return { label: 'Moderate', cls: 'score-moderate' };
    return { label: 'Neutral', cls: 'score-neutral' };
}

/** Shorten company name if too long */
function shortName(name, maxLen = 28) {
    if (!name || name.length <= maxLen) return name;
    return name.slice(0, maxLen - 1) + '…';
}

function AIPicks() {
    const [picks, setPicks] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { ref, isVisible } = useScrollReveal(0.1);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getAIStockPicks(8)
            .then(data => { if (!cancelled) setPicks(data || []); })
            .catch(() => { if (!cancelled) setPicks([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return (
            <section className="ai-picks-section">
                <div className="ai-picks-header">
                    <div className="ai-picks-title">
                        <Sparkles size={20} />
                        <h2>AI Stock Picks</h2>
                    </div>
                </div>
                <div className="ai-picks-grid">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="ai-pick-card skeleton-card">
                            <div className="skeleton-line wide" />
                            <div className="skeleton-line medium" />
                            <div className="skeleton-line narrow" />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (picks.length === 0) return null;

    return (
        <section ref={ref} className={`ai-picks-section scroll-fade ${isVisible ? 'visible' : ''}`}>
            <div className="ai-picks-header">
                <div className="ai-picks-title">
                    <Sparkles size={20} className="sparkle-icon" />
                    <h2>AI Stock Picks</h2>
                    <span className="ai-badge">AI-Scored</span>
                </div>
                <p className="ai-picks-subtitle">
                    Stocks with the strongest technical outlook based on trend, momentum, and volume analysis
                </p>
            </div>

            <div className="ai-picks-grid">
                {picks.map((pick) => {
                    const tier = getScoreTier(pick.score);
                    const isPositive = (pick.changePercent || 0) >= 0;

                    return (
                        <div
                            key={pick.symbol}
                            className="ai-pick-card"
                            onClick={() => navigate(`/stock/${pick.symbol}`)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && navigate(`/stock/${pick.symbol}`)}
                        >
                            <div className="pick-header">
                                <div className="pick-symbol-group">
                                    <span className="pick-symbol">{pick.symbol}</span>
                                    <span className="pick-sector">{pick.sector || 'N/A'}</span>
                                </div>
                                <div className={`pick-score ${tier.cls}`}>
                                    <BarChart3 size={14} />
                                    <span>{pick.score}</span>
                                </div>
                            </div>

                            <div className="pick-name">{shortName(pick.companyName)}</div>

                            <div className="pick-price-row">
                                <span className="pick-price">NPR {(pick.ltp || 0).toLocaleString('en-IN')}</span>
                                <span className={`pick-change ${isPositive ? 'positive' : 'negative'}`}>
                                    {isPositive ? '+' : ''}{(pick.changePercent || 0).toFixed(2)}%
                                </span>
                            </div>

                            <div className="pick-reasons">
                                {(pick.reasons || []).slice(0, 2).map((reason, i) => (
                                    <div key={i} className="pick-reason">
                                        <Zap size={12} className="reason-icon" />
                                        <span>{reason}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="pick-cta">
                                <span>View Details</span>
                                <ChevronRight size={14} />
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="ai-picks-disclaimer">
                AI-scored based on technical analysis · Not financial advice
            </p>
        </section>
    );
}

export default AIPicks;
