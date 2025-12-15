import React from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <div className="error-content">
                        <div className="error-icon">⚠️</div>
                        <h2>Oops! Something went wrong</h2>
                        <p className="error-message">
                            {this.state.error?.message || 'An unexpected error occurred'}
                        </p>
                        <button className="btn btn-primary" onClick={this.handleRetry}>
                            Try Again
                        </button>
                        {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                            <details className="error-details">
                                <summary>Error Details</summary>
                                <pre>{this.state.errorInfo.componentStack}</pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
