import { Component, ReactNode, ErrorInfo } from 'react';
import { useLocation } from 'react-router-dom';
import { logError } from '../logging/clientLogger';

export interface RouteErrorBoundaryProps {
  children?: ReactNode;
  pathname: string;
  onReset?: () => void;
}

export interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Route-level error boundary.
 *
 * Stays mounted across route changes and resets via componentDidUpdate when the
 * pathname changes away from the route where the error occurred.
 *
 * Catches unmount cleanup throws (such as map library teardown collisions)
 * and render-time exceptions within route components, preserving the outer
 * application shell and navigation bar.
 */
export class RouteErrorBoundaryInner extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  private errorPath: string | null = null;

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isHandled =
      typeof error === 'object' && error !== null && (error as any).handled === true;

    if (!isHandled) {
      logError('[ErrorBoundary] Uncaught route error', { error, errorInfo });
    }
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (this.state.hasError) {
      if (this.props.pathname !== prevProps.pathname && this.props.pathname !== this.errorPath) {
        this.handleReset();
      }
    }
  }

  handleReset = () => {
    this.errorPath = null;
    this.setState({
      hasError: false,
      error: null,
    });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      // 401 sentinel check: handled authentication session expiries are
      // handled by AuthProvider. Render null defensively without a fallback card.
      if ((this.state.error as any)?.handled === true) {
        return null;
      }

      if (!this.errorPath) {
        this.errorPath = this.props.pathname;
      }

      return (
        <div
          data-testid="route-error-fallback"
          className="flex flex-col items-center justify-center min-h-[60vh] w-full p-6 text-center"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-100">Something went wrong</h2>
            <p className="mt-2 text-sm text-slate-400">
              An unexpected error occurred while loading this view.
            </p>

            {this.state.error?.message && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-300 select-none">
                  Error Details
                </summary>
                <p className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3 font-mono text-xs text-red-300 break-all select-all">
                  {this.state.error.message}
                </p>
              </details>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-slate-200 shadow-sm hover:bg-slate-700 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500/50"
              >
                Reload page
              </button>
              <a
                href="/dashboard"
                className="rounded-lg border border-slate-700/60 bg-transparent px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors"
              >
                Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children ?? null;
  }
}

export function RouteErrorBoundary({
  children,
  onReset,
}: {
  children?: ReactNode;
  onReset?: () => void;
}) {
  const location = useLocation();
  return (
    <RouteErrorBoundaryInner pathname={location.pathname} onReset={onReset}>
      {children}
    </RouteErrorBoundaryInner>
  );
}

export default RouteErrorBoundary;
