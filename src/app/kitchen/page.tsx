"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CheckCheck, Clock, RefreshCw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner, Loading, PageHeader } from "@/components/feedback";
import { api, errorMessage } from "@/lib/client";
import { formatTime } from "@/lib/time";
import type { KitchenOrderDto, OrderItemDto } from "@/lib/types";
import { cn } from "@/lib/utils";

function minutesAgo(iso: string | null): number {
  return iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)) : 0;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrderDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReady, setShowReady] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      setOrders(await api<KitchenOrderDto[]>("/api/kitchen"));
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  async function mark(body: { itemId?: number; orderId?: number; status: "ready" | "sent" }) {
    // Optimistic update so the kitchen sees the change immediately.
    setOrders((prev) =>
      prev?.map((o) => ({
        ...o,
        items: o.items.map((i) =>
          (body.itemId && i.id === body.itemId) || (body.orderId && o.id === body.orderId)
            ? { ...i, kitchenStatus: body.status }
            : i,
        ),
      })) ?? null,
    );
    try {
      await api("/api/kitchen", { method: "PUT", json: body });
    } catch (e) {
      setError(errorMessage(e));
    }
    load();
  }

  const isDone = (o: KitchenOrderDto) => o.items.every((i) => i.kitchenStatus === "ready");
  const visible = (orders ?? []).filter((o) => showReady || !isDone(o));
  const pendingCount = (orders ?? []).filter((o) => !isDone(o)).length;

  return (
    <div>
      <PageHeader title="Köök">
        <span className="text-sm text-slate-500">
          {updatedAt ? `Uuendatud ${formatTime(updatedAt)} · iga 10 s` : ""}
        </span>
        <Button variant={showReady ? "default" : "secondary"} onClick={() => setShowReady((s) => !s)}>
          <CheckCheck /> {showReady ? "Peida valmis" : "Näita valmis"}
        </Button>
        <Button variant="secondary" size="icon" onClick={load} aria-label="Värskenda">
          <RefreshCw />
        </Button>
      </PageHeader>

      {error && <ErrorBanner message={error} onRetry={load} className="mb-4" />}
      {!orders && !error && <Loading />}

      {orders && visible.length === 0 && (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <CheckCheck className="mx-auto size-12 text-emerald-500" />
          <p className="mt-3 text-lg font-semibold text-slate-700">
            {pendingCount === 0 ? "Kõik tellimused on valmis" : "Pole midagi kuvada"}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visible.map((o) => {
          const done = isDone(o);
          const latest = o.items.reduce<string | null>((m, i) => (i.sentAt && (!m || i.sentAt > m) ? i.sentAt : m), null);
          const mins = minutesAgo(latest);
          return (
            <section
              key={o.id}
              className={cn(
                "flex flex-col overflow-hidden rounded-lg border-2 bg-white shadow-sm",
                done ? "border-emerald-200 opacity-70" : mins >= 20 ? "border-red-300" : "border-amber-300",
              )}
            >
              <header
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  done ? "bg-emerald-50" : mins >= 20 ? "bg-red-50" : "bg-amber-50",
                )}
              >
                <h2 className="text-xl font-bold">{o.tableName}</h2>
                <span className="text-sm text-slate-500">#{o.id}</span>
                <span className="ml-auto flex items-center gap-1 text-sm font-semibold text-slate-700">
                  <Clock className="size-4" />
                  {latest ? formatTime(latest) : ""}
                  {!done && <span className={cn("ml-1", mins >= 20 && "text-red-600")}>({mins} min)</span>}
                </span>
              </header>
              <ul className="flex-1 divide-y divide-slate-100">
                {o.items.map((i: OrderItemDto) => {
                  const ready = i.kitchenStatus === "ready";
                  return (
                    <li key={i.id} className="flex items-center gap-3 px-4 py-2">
                      <span className={cn("tabular w-10 text-2xl font-bold", ready && "text-slate-400")}>{i.quantity}×</span>
                      <div className="min-w-0 flex-1">
                        <div className={cn("text-lg font-semibold leading-snug", ready && "text-slate-400 line-through")}>
                          {i.productName}
                        </div>
                        {i.note && (
                          <div className="rounded bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-900">
                            {i.note}
                          </div>
                        )}
                      </div>
                      <Button
                        variant={ready ? "ghost" : "secondary"}
                        size="icon"
                        aria-label={ready ? "Märgi tagasi tegemisse" : "Märgi valmis"}
                        onClick={() => mark({ itemId: i.id, status: ready ? "sent" : "ready" })}
                      >
                        {ready ? <Undo2 className="text-slate-400" /> : <Check className="text-emerald-600" />}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {!done && (
                <div className="p-3">
                  <Button variant="primary" size="lg" className="w-full" onClick={() => mark({ orderId: o.id, status: "ready" })}>
                    <CheckCheck /> Valmis
                  </Button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
