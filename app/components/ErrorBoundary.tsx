import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { SecureLogger } from "~/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error securely without exposing sensitive information
    SecureLogger.error("React Error Boundary caught an error", error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: "ErrorBoundary",
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-600 text-xl font-semibold mb-2">
            Something went wrong
          </div>
          <div className="text-red-500 text-sm mb-4">
            We're sorry, but something unexpected happened. Please try
            refreshing the page.
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Refresh Page
          </button>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details className="mt-4 w-full">
              <summary className="cursor-pointer text-red-600 font-medium">
                Error Details (Development Only)
              </summary>
              <pre className="mt-2 p-4 bg-red-100 rounded text-xs overflow-auto">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Specialized error boundaries for different parts of the app
export const ChatErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <ErrorBoundary
    fallback={
      <div className="flex flex-col items-center justify-center p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="text-yellow-600 text-xl font-semibold mb-2">
          Chat Temporarily Unavailable
        </div>
        <div className="text-yellow-500 text-sm mb-4">
          There was an issue loading the chat. Please try refreshing the page or
          contact support if the problem persists.
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
        >
          Refresh Chat
        </button>
      </div>
    }
    onError={(error, errorInfo) => {
      SecureLogger.error("Chat component error", error, {
        component: "ChatErrorBoundary",
        componentStack: errorInfo.componentStack,
      });
    }}
  >
    {children}
  </ErrorBoundary>
);

export const MessageErrorBoundary: React.FC<{
  children: ReactNode;
  messageId?: string;
}> = ({ children, messageId }) => (
  <ErrorBoundary
    fallback={
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-600 text-sm font-medium">
          Failed to render message
        </div>
        <div className="text-red-500 text-xs mt-1">
          This message could not be displayed properly.
        </div>
      </div>
    }
    onError={(error, errorInfo) => {
      SecureLogger.error("Message component error", error, {
        component: "MessageErrorBoundary",
        messageId,
        componentStack: errorInfo.componentStack,
      });
    }}
  >
    {children}
  </ErrorBoundary>
);

// Hook for handling async errors in functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    SecureLogger.error("Async error caught by useErrorHandler", error);
    setError(error);
  }, []);

  // Throw error to be caught by error boundary
  if (error) {
    throw error;
  }

  return { handleError, resetError };
}

// Async error boundary for handling promise rejections
export const AsyncErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      SecureLogger.error(
        "Unhandled promise rejection",
        new Error(event.reason),
        {
          component: "AsyncErrorBoundary",
          reason: event.reason,
        }
      );
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
    };
  }, []);

  return <>{children}</>;
};
