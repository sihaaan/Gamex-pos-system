"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Short name of the screen shown in the fallback copy. */
  label?: string;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="mx-auto grid max-w-2xl gap-4 px-4 py-10">
        <section className="rounded-xl border border-danger-line bg-danger-soft p-6 text-danger-ink">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <div>
              <h1 className="text-lg font-semibold">
                {this.props.label ?? "This screen"} hit an unexpected error.
              </h1>
              <p className="mt-1 text-sm">
                Nothing was posted. Reload to continue; if it keeps happening,
                note what you tapped last and tell the manager.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={this.handleReset} variant="secondary">
              <RotateCw className="h-4 w-4" />
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </section>
      </main>
    );
  }
}
