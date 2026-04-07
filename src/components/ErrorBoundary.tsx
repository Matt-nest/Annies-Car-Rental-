import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            backgroundColor: 'var(--bg-main, #0f172a)',
            color: 'var(--text-primary, #f8fafc)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔧</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Something went wrong
            </h1>
            <p style={{ opacity: 0.7, marginBottom: '1.5rem', lineHeight: 1.5 }}>
              We're sorry — an unexpected error occurred. Please refresh the page or contact us at{' '}
              <a href="tel:+17729856667" style={{ color: '#d4a843' }}>(772) 985-6667</a>.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.75rem',
                border: 'none',
                backgroundColor: '#d4a843',
                color: '#0f172a',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
