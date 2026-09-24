"use client";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
export class ActivityErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300/40 p-6"
        >
          <h2 className="text-lg font-medium">
            Trading data is temporarily unavailable
          </h2>
          <p className="mt-2 text-sm text-white/70">
            Please try again. The Growth page remains available.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => this.setState({ failed: false })}
          >
            Try again
          </Button>
        </div>
      );
    return this.props.children;
  }
}
