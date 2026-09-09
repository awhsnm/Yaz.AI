import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/logError";

interface Props { children: ReactNode }
interface State { hasError: boolean }

/** Shows a friendly fallback and quietly records the technical detail. */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void logError(error.message, { feature: "react", severity: "fatal", details: `${error.stack ?? ""}\n${info.componentStack ?? ""}` });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold font-display text-foreground">Something went wrong</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We've logged the problem and the team will look into it. Your work is saved.
          </p>
          <Button onClick={() => window.location.reload()}>Reload the page</Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
