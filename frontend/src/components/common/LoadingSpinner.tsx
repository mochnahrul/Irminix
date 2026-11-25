import { Loader2 } from "lucide-react";

export function LoadingSpinner({ label = "Consulting Irminsul..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-secondary">
      <Loader2 className="h-5 w-5 animate-spin text-irminsul" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
