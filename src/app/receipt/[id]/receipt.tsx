"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LayoutGrid, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner, Loading } from "@/components/feedback";
import { api, errorMessage } from "@/lib/client";
import { formatEur, formatVatRate } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { calcTotals } from "@/lib/totals";
import type { OrderDto } from "@/lib/types";

export function Receipt({
  id,
  restaurantName,
  cashReceived,
  change,
}: {
  id: string;
  restaurantName: string;
  cashReceived: number;
  change: number;
}) {
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOrder(await api<OrderDto>(`/api/orders/${id}`));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => calcTotals(order?.items ?? []), [order]);

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!order) return <Loading />;
  if (order.status !== "paid")
    return (
      <div className="mx-auto max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
        <p className="font-semibold">Tellimus ei ole veel makstud.</p>
        <Button asChild className="mt-4">
          <Link href={`/order/${order.id}`}>Ava tellimus</Link>
        </Button>
      </div>
    );

  const byMethod = (m: "cash" | "card") =>
    order.payments.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0);
  const cash = byMethod("cash");
  const card = byMethod("card");

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center gap-3 rounded-lg bg-emerald-50 p-4 text-emerald-800 print:hidden">
        <CheckCircle2 className="size-8 shrink-0" />
        <div>
          <div className="text-lg font-bold">Makse õnnestus</div>
          <div className="text-sm">{order.tableName} on nüüd vaba.</div>
        </div>
      </div>

      <article className="rounded-lg border border-slate-200 bg-white p-6 font-mono text-sm shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="text-center">
          <h1 className="text-lg font-bold">{restaurantName}</h1>
          <p className="text-slate-500">Kassatšekk</p>
        </header>
        <div className="my-3 border-t border-dashed border-slate-300" />
        <dl className="grid grid-cols-2 gap-y-0.5">
          <dt>Tšekk nr</dt>
          <dd className="text-right font-bold">{order.receiptNo}</dd>
          <dt>Kuupäev</dt>
          <dd className="text-right">{formatDateTime(order.paidAt ?? order.createdAt)}</dd>
          <dt>Laud</dt>
          <dd className="text-right">{order.tableName}</dd>
        </dl>
        <div className="my-3 border-t border-dashed border-slate-300" />
        <ul className="space-y-1.5">
          {order.items.map((i) => (
            <li key={i.id}>
              <div className="flex justify-between gap-2">
                <span>{i.productName}</span>
                <span className="tabular shrink-0">{formatEur(i.unitPrice * i.quantity)}</span>
              </div>
              <div className="text-xs text-slate-500">
                {i.quantity} × {formatEur(i.unitPrice)}
                {i.note ? ` · ${i.note}` : ""}
              </div>
            </li>
          ))}
        </ul>
        <div className="my-3 border-t border-dashed border-slate-300" />
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left font-normal">KM</th>
              <th className="text-right font-normal">Neto</th>
              <th className="text-right font-normal">KM</th>
              <th className="text-right font-normal">Kokku</th>
            </tr>
          </thead>
          <tbody>
            {totals.byRate.map((r) => (
              <tr key={r.vatRate} className="tabular">
                <td>{formatVatRate(r.vatRate)}</td>
                <td className="text-right">{formatEur(r.net)}</td>
                <td className="text-right">{formatEur(r.vat)}</td>
                <td className="text-right">{formatEur(r.gross)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="my-3 border-t border-dashed border-slate-300" />
        <div className="flex items-baseline justify-between text-lg font-bold">
          <span>KOKKU</span>
          <span className="tabular text-2xl">{formatEur(order.total)}</span>
        </div>
        <div className="mt-2 space-y-0.5">
          {cash > 0 && (
            <div className="flex justify-between">
              <span>Sularaha</span>
              <span className="tabular">{formatEur(cash)}</span>
            </div>
          )}
          {card > 0 && (
            <div className="flex justify-between">
              <span>Kaart</span>
              <span className="tabular">{formatEur(card)}</span>
            </div>
          )}
          {cashReceived > 0 && change > 0 && (
            <>
              <div className="flex justify-between text-slate-500">
                <span>Sularaha saadud</span>
                <span className="tabular">{formatEur(cashReceived)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tagastatud</span>
                <span className="tabular">{formatEur(change)}</span>
              </div>
            </>
          )}
        </div>
        <div className="my-3 border-t border-dashed border-slate-300" />
        <p className="text-center text-slate-500">Aitäh ja tule jälle!</p>
      </article>

      <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
        <Button variant="secondary" size="lg" onClick={() => window.print()}>
          <Printer /> Prindi
        </Button>
        <Button variant="primary" size="lg" asChild>
          <Link href="/">
            <LayoutGrid /> Lauad
          </Link>
        </Button>
      </div>
    </div>
  );
}
