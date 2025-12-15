import './LoadingSpinner.css';

function LoadingSpinner({ fullPage = false, text = 'Loading...' }) {
    if (fullPage) {
        return (
            <div className="loading-overlay">
                <div className="loading-content">
                    <div className="spinner"></div>
                    {text && <p className="loading-text">{text}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="loading-inline">
            <div className="spinner spinner-sm"></div>
            {text && <span className="loading-text">{text}</span>}
        </div>
    );
}

export default LoadingSpinner;
