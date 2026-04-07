import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg-primary, #0f1724)' }}>
          <div
            className="max-w-md w-full rounded-2xl p-8 text-center space-y-5"
            style={{
              backgroundColor: 'var(--bg-card, #1a2332)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
            }}
          >
            <div
              className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
            >
              <AlertTriangle size={24} style={{ color: '#ef4444' }} />
            </div>

            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary, #fff)' }}>
                Something went wrong
              </h2>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary, #8896a8)' }}>
                An unexpected error occurred. You can try refreshing the page or going back.
              </p>
            </div>

            {this.state.error && (
              <div
                className="text-left text-xs font-mono p-3 rounded-lg overflow-auto max-h-32"
                style={{
                  backgroundColor: 'rgba(239,68,68,0.05)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  color: '#f87171',
                }}
              >
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all"
                style={{
                  backgroundColor: 'var(--bg-card-hover, rgba(255,255,255,0.04))',
                  color: 'var(--text-secondary, #8896a8)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2.5 text-sm font-medium rounded-xl flex items-center gap-2 transition-all hover:opacity-90"
                style={{
                  backgroundColor: 'var(--accent-color, #D4AF37)',
                  color: 'var(--accent-fg, #000)',
                }}
              >
                <RefreshCw size={14} />
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
