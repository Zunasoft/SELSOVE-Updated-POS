import React from 'react';

/**
 * Without this, any uncaught render-time error (a null field from an API
 * response, a bad array access, etc.) anywhere in the tree unmounts the whole
 * app and leaves a blank white screen with no way back except a manual
 * refresh. This catches it, shows a recoverable message instead, and lets
 * "Try Again" re-mount just the boundary's children rather than losing the
 * whole session.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error caught by ErrorBoundary:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-sm font-bold text-[color:var(--text-primary)]">
          {this.props.label || 'Something went wrong on this screen.'}
        </div>
        <div className="max-w-md text-[12px] text-[color:var(--text-muted)]">
          {this.state.error?.message || 'An unexpected error occurred.'}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={this.handleReset}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-indigo-700"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl px-4 py-2 text-[12.5px] font-bold text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-subtle)]"
            style={{ background: 'var(--bg-subtle)' }}
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
