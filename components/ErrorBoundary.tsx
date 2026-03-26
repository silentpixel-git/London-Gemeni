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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#293351]/80 backdrop-blur-sm p-4">
          <div className="bg-white border-2 border-[#CD7B00] rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-4 mb-6 text-[#CD7B00]">
              <div className="p-3 bg-[#CD7B00]/10 rounded-full">
                <AlertCircle size={32} />
              </div>
              <h2 className="font-serif text-2xl font-bold text-[#293351]">Case File Error</h2>
            </div>
            
            <p className="text-[#293351] opacity-80 mb-8 leading-relaxed font-sans">
              {errorMessage}
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-[#293351] text-white rounded-xl font-bold hover:bg-[#1a2238] transition-all shadow-lg active:scale-95"
              >
                Restart Investigation
              </button>
              <button 
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full py-3 border border-[#C5CBDD] text-[#293351] rounded-xl font-medium hover:bg-[#FDF9F5] transition-all"
              >
                Dismiss
              </button>
            </div>
            
            {isCloudSyncError && (
              <p className="mt-6 text-[10px] uppercase tracking-widest text-[#929DBF] text-center">
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
