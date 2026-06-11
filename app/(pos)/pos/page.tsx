import { ErrorBoundary } from "@/components/error-boundary";
import { PosShell } from "@/components/pos/pos-shell";

export default function PosPage() {
  return (
    <ErrorBoundary label="The selling counter">
      <PosShell />
    </ErrorBoundary>
  );
}
