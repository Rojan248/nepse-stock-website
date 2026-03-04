import './SignalBadges.css';

/**
 * Signal Badges Component
 * Displays technical signal badges with color-coded sentiments
 */

const SENTIMENT_COLORS = {
    bullish: 'signal--bullish',
    bearish: 'signal--bearish',
    caution: 'signal--caution',
    opportunity: 'signal--opportunity',
    info: 'signal--info'
};

function SignalBadges({ signals }) {
    if (!signals || signals.length === 0) return null;

    return (
        <div className="signal-badges">
            {signals.map((signal, i) => (
                <span
                    key={`${signal.type}-${i}`}
                    className={`signal-badge ${SENTIMENT_COLORS[signal.sentiment] || 'signal--info'}`}
                    title={`${signal.label} (${signal.sentiment})`}
                >
                    {signal.label}
                </span>
            ))}
        </div>
    );
}

export default SignalBadges;
