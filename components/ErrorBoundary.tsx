import React, { Component, ErrorInfo, ReactNode } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = 'An unexpected error occurred.';
      let isCloudSyncError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Investigation Interrupted: ${parsed.error}`;
            isCloudSyncError = true;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-lb-primary/80 backdrop-blur-sm p-4">
          <div className="bg-lb-paper border-2 border-lb-accent rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-4 mb-6 text-lb-accent">
              <div className="p-3 bg-lb-accent/10 rounded-full">
                <AlertCircle size={32} />
              </div>
              <h2 className="font-serif text-2xl font-bold text-lb-primary">Case File Error</h2>
            </div>

            <p className="text-lb-primary opacity-80 mb-8 leading-relaxed font-sans">
              {errorMessage}
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-lb-primary text-white rounded-xl font-bold hover:bg-lb-primary/80 transition-all shadow-lg active:scale-95"
              >
                Restart Investigation
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full py-3 border border-lb-border text-lb-primary rounded-xl font-medium hover:bg-lb-bg transition-all"
              >
                Dismiss
              </button>
            </div>

            {isCloudSyncError && (
              <p className="mt-6 text-[10px] uppercase tracking-widest text-lb-muted text-center">
                Cloud Sync Error Detected
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
