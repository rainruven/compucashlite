"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { ErrorBanner } from "@/components/feedback";
import { api, errorMessage } from "@/lib/client";
import { formatEur, fromCents, parseAmount, toCents } from "@/lib/money";
import type { OrderDto, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PaymentResult {
  change: number;
  fullyPaid: boolean;
  remaining: number;
  order: OrderDto;
}

const toInput = (n: number) => n.toFixed(2).replace(".", ",");

export function PaymentDialog({
  order,
  open,
  onOpenChange,
  onUpdated,
  onPaid,
}: {
  order: OrderDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (order: OrderDto) => void;
  onPaid: (order: OrderDto, cashChange: number, cashReceived: number) => void;
}) {
  const remainingCents = Math.max(0, toCents(order.total) - toCents(order.paid));
  const remaining = fromCents(remainingCents);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amountText, setAmountText] = useState(toInput(remaining));
  const [processing, setProcessing] = useState<null | "card" | "cash">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ order: OrderDto; change: number; received: number } | null>(null);
  const [cashReceivedTotal, setCashReceivedTotal] = useState(0);

  useEffect(() => {
    if (open) {
      setAmountText(toInput(remaining));
      setError(null);
      setDone(null);
      setMethod("cash");
      setCashReceivedTotal(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const amount = parseAmount(amountText);
  const amountCents = Number.isFinite(amount) ? toCents(amount) : NaN;
  const changeCents = method === "cash" && amountCents > remainingCents ? amountCents - remainingCents : 0;

  const validation = useMemo(() => {
    if (!Number.isFinite(amountCents)) return "Sisesta korrektne summa.";
    if (amountCents <= 0) return "Summa peab olema suurem kui 0.";
    if (method === "card" && amountCents > remainingCents) return "Kaardimakse ei tohi ületada tasumata summat.";
    return null;
  }, [amountCents, method, remainingCents]);

  const quickCash = useMemo(() => {
    const r = remaining;
    const set = new Set<number>([r]);
    for (const note of [5, 10, 20, 50, 100]) if (note > r) set.add(note);
    set.add(Math.ceil(r));
    set.add(Math.ceil(r / 10) * 10);
    return [...set].filter((v) => v >= r).sort((a, b) => a - b).slice(0, 5);
  }, [remaining]);

  async function pay() {
    if (validation) return;
    setError(null);
    setProcessing(method);
    try {
      if (method === "card") {
        // Simulated card terminal.
        await new Promise((r) => setTimeout(r, 1500));
      }
      const res = await api<PaymentResult>(`/api/orders/${order.id}/payments`, {
        method: "POST",
        json: { method, amount: fromCents(amountCents) },
      });
      const received = method === "cash" ? cashReceivedTotal + fromCents(amountCents) : cashReceivedTotal;
      setCashReceivedTotal(received);
      if (res.fullyPaid) {
        if (res.change > 0) setDone({ order: res.order, change: res.change, received });
        else onPaid(res.order, 0, received);
      } else {
        onUpdated(res.order);
        setAmountText(toInput(res.remaining));
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setProcessing(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !processing && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        {done ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="size-16 text-emerald-600" />
            <DialogTitle>Makstud!</DialogTitle>
            <DialogDescription>Anna kliendile tagasi</DialogDescription>
            <div className="tabular text-5xl font-bold text-emerald-700">{formatEur(done.change)}</div>
            <Button variant="primary" size="lg" className="w-full" onClick={() => onPaid(done.order, done.change, done.received)}>
              Näita tšekki
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Makse – {order.tableName}</DialogTitle>
              <DialogDescription>Vali makseviis. Võid maksta osaliselt sularahas ja osaliselt kaardiga.</DialogDescription>
            </DialogHeader>

            <div className="rounded-lg bg-slate-900 p-4 text-white">
              <div className="flex items-baseline justify-between text-slate-300">
                <span>Kokku</span>
                <span className="tabular">{formatEur(order.total)}</span>
              </div>
              {order.paid > 0 && (
                <div className="flex items-baseline justify-between text-emerald-300">
                  <span>Makstud</span>
                  <span className="tabular">{formatEur(order.paid)}</span>
                </div>
              )}
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg font-semibold">Tasuda</span>
                <span className="tabular text-4xl font-bold">{formatEur(remaining)}</span>
              </div>
            </div>

            {order.payments.length > 0 && (
              <ul className="space-y-1 text-sm text-slate-600">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>{p.method === "cash" ? "Sularaha" : "Kaart"}</span>
                    <span className="tabular">{formatEur(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-2 gap-2">
              {(["cash", "card"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMethod(m);
                    if (m === "card" && amountCents > remainingCents) setAmountText(toInput(remaining));
                  }}
                  disabled={!!processing}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border-2 font-semibold transition-colors",
                    method === m
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                  )}
                >
                  {m === "cash" ? <Banknote className="size-6" /> : <CreditCard className="size-6" />}
                  {m === "cash" ? "Sularaha" : "Kaart"}
                </button>
              ))}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pay-amount">{method === "cash" ? "Saadud summa (€)" : "Kaardiga makstav summa (€)"}</Label>
              <Input
                id="pay-amount"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="tabular h-14 text-2xl font-semibold"
                disabled={!!processing}
              />
              {method === "cash" && (
                <div className="flex flex-wrap gap-2">
                  {quickCash.map((v) => (
                    <Button key={v} variant="secondary" size="sm" className="tabular flex-1" onClick={() => setAmountText(toInput(v))}>
                      {formatEur(v)}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {method === "cash" && changeCents > 0 && (
              <div className="flex items-baseline justify-between rounded-lg bg-emerald-50 p-3 text-emerald-800">
                <span className="font-semibold">Tagastada</span>
                <span className="tabular text-3xl font-bold">{formatEur(fromCents(changeCents))}</span>
              </div>
            )}
            {method === "cash" && Number.isFinite(amountCents) && amountCents > 0 && amountCents < remainingCents && (
              <p className="text-sm text-slate-500">
                Osamakse. Pärast seda jääb tasuda {formatEur(fromCents(remainingCents - amountCents))}.
              </p>
            )}

            {error && <ErrorBanner message={error} />}
            {validation && amountText !== "" && <p className="text-sm text-red-600">{validation}</p>}

            <Button variant="primary" size="lg" className="w-full text-xl" disabled={!!validation || !!processing} onClick={pay}>
              {processing === "card" ? (
                <>
                  <Loader2 className="animate-spin" /> Ühendan kaarditerminaliga…
                </>
              ) : processing ? (
                <>
                  <Loader2 className="animate-spin" /> Salvestan…
                </>
              ) : method === "cash" ? (
                <>
                  <Banknote /> Maksa sularahas
                </>
              ) : (
                <>
                  <CreditCard /> Maksa kaardiga
                </>
              )}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
