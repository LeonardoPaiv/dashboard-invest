import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0b] text-white p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.742-3L13.742 3.646c-.76-1.333-2.694-1.333-3.464 0L3.34 16c-.76 1.333.192 3 1.742 3z"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black">Ops! Ocorreu um erro no dashboard.</h1>
            <p className="text-white/40 max-w-md mx-auto">
              Pedimos desculpas pelo inconveniente. Tente recarregar a página.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-primary text-white font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            Recarregar Página
          </button>
          {this.state.error && (
            <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-xl text-left max-w-2xl w-full">
              <p className="text-[10px] uppercase font-black text-white/20 mb-2">Detalhes do Erro</p>
              <pre className="text-xs text-red-400 overflow-auto no-scrollbar font-mono py-2 whitespace-pre-wrap">
                {this.state.error.toString()}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
