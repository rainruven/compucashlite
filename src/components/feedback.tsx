"use client";

import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorBanner({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center",
        className,
      )}
    >
      <AlertTriangle className="size-6 shrink-0" />
      <p className="flex-1 font-medium">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw /> Proovi uuesti
        </Button>
      )}
    </div>
  );
}

export function Loading({ label = "Laen…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <Loader2 className="size-6 animate-spin" />
      {label}
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 sm:mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Small transient notice in the bottom corner. */
export function Toast({ message, tone = "success" }: { message: string | null; tone?: "success" | "error" }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-lg px-5 py-3 font-semibold text-white shadow-lg print:hidden",
        tone === "success" ? "bg-slate-900" : "bg-red-600",
      )}
    >
      {message}
    </div>
  );
}
