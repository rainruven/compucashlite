"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Users } from "lucide-react";
import { ErrorBanner, Loading, PageHeader } from "@/components/feedback";
import { api, errorMessage } from "@/lib/client";
import { formatEur } from "@/lib/money";
import { formatTime } from "@/lib/time";
import type { OrderDto, TableDto } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function TablesPage() {
  const router = useRouter();
  const [tables, setTables] = useState<TableDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setTables(await api<TableDto[]>("/api/tables"));
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

  async function openTable(table: TableDto) {
    setOpening(table.id);
    try {
      const order = await api<OrderDto>("/api/orders", { method: "POST", json: { tableId: table.id } });
      router.push(`/order/${order.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setOpening(null);
    }
  }

  const busy = tables?.filter((t) => t.openOrder && t.openOrder.itemCount > 0) ?? [];
  const openTotal = busy.reduce((s, t) => s + (t.openOrder?.total ?? 0), 0);

  return (
    <div>
      <PageHeader title="Lauad">
        {tables && (
          <div className="flex gap-2 text-sm">
            <span className="rounded-lg bg-white px-3 py-2 font-medium text-slate-600 shadow-sm">
              Vabu: <b className="text-slate-900">{tables.length - busy.length}</b>
            </span>
            <span className="rounded-lg bg-amber-100 px-3 py-2 font-medium text-amber-800 shadow-sm">
              Hõivatud: <b>{busy.length}</b> · <span className="tabular">{formatEur(openTotal)}</span>
            </span>
          </div>
        )}
      </PageHeader>

      {error && <ErrorBanner message={error} onRetry={load} className="mb-4" />}
      {!tables && !error && <Loading />}

      {tables && tables.length === 0 && (
        <p className="rounded-lg bg-white p-8 text-center text-slate-500 shadow-sm">Laudu pole veel lisatud.</p>
      )}

      {tables && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {tables.map((t) => {
            const occupied = !!t.openOrder && t.openOrder.itemCount > 0;
            return (
              <button
                key={t.id}
                onClick={() => openTable(t)}
                disabled={opening !== null}
                className={cn(
                  "relative flex aspect-[4/3] min-h-32 flex-col justify-between rounded-lg border-2 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:opacity-70",
                  occupied
                    ? "border-amber-400 bg-amber-50 text-amber-950"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("text-xl font-bold sm:text-2xl", occupied ? "text-amber-900" : "text-slate-700")}>
                    {t.name}
                  </span>
                  <span className="flex items-center gap-1 text-sm">
                    <Users className="size-4" />
                    {t.seats}
                  </span>
                </div>
                {occupied ? (
                  <div>
                    <div className="tabular text-2xl font-bold text-amber-700 sm:text-3xl">
                      {formatEur(t.openOrder!.total)}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-sm text-amber-800">
                      <Clock className="size-4" /> {formatTime(t.openOrder!.createdAt)}
                    </div>
                  </div>
                ) : (
                  <span className="text-sm font-medium uppercase tracking-wide">Vaba</span>
                )}
                {opening === t.id && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/60">
                    <Loader2 className="size-8 animate-spin text-slate-600" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
