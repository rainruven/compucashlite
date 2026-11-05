"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChefHat, Loader2, MessageSquare, Minus, Plus, ShoppingCart, Trash2, Wallet, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ErrorBanner, Loading, Toast } from "@/components/feedback";
import { PaymentDialog } from "@/components/payment-dialog";
import { api, errorMessage } from "@/lib/client";
import { formatEur, formatVatRate } from "@/lib/money";
import { calcTotals } from "@/lib/totals";
import type { CategoryDto, OrderDto, OrderItemDto, ProductDto } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusLabel: Record<string, { text: string; className: string }> = {
  new: { text: "Uus", className: "bg-slate-100 text-slate-600" },
  sent: { text: "Köögis", className: "bg-amber-100 text-amber-800" },
  ready: { text: "Valmis", className: "bg-emerald-100 text-emerald-800" },
};

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [categories, setCategories] = useState<CategoryDto[] | null>(null);
  const [products, setProducts] = useState<ProductDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [noteItem, setNoteItem] = useState<OrderItemDto | null>(null);
  const [noteText, setNoteText] = useState("");
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const cartRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [o, c, p] = await Promise.all([
        api<OrderDto>(`/api/orders/${id}`),
        api<CategoryDto[]>("/api/categories?active=1"),
        api<ProductDto[]>("/api/products?active=1"),
      ]);
      setOrder(o);
      setCategories(c);
      setProducts(p);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (order?.status === "paid") router.replace(`/receipt/${order.id}`);
  }, [order, router]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  /** Runs order mutations one after another so quick taps never race. */
  function mutate(fn: () => Promise<OrderDto>) {
    setPending((n) => n + 1);
    setActionError(null);
    const p = queue.current
      .then(fn)
      .then((o) => setOrder(o))
      .catch((e) => setActionError(errorMessage(e)))
      .finally(() => setPending((n) => n - 1));
    queue.current = p;
    return p;
  }

  const addProduct = (p: ProductDto) =>
    mutate(() => api<OrderDto>(`/api/orders/${id}/items`, { method: "POST", json: { productId: p.id } }));
  const setQty = (item: OrderItemDto, quantity: number) =>
    mutate(() => api<OrderDto>(`/api/orders/${id}/items/${item.id}`, { method: "PUT", json: { quantity } }));
  const removeItem = (item: OrderItemDto) =>
    mutate(() => api<OrderDto>(`/api/orders/${id}/items/${item.id}`, { method: "DELETE" }));
  const saveNote = (item: OrderItemDto, note: string) =>
    mutate(() => api<OrderDto>(`/api/orders/${id}/items/${item.id}`, { method: "PUT", json: { note } }));

  function sendToKitchen() {
    mutate(async () => {
      const res = await api<{ sent: number; order: OrderDto }>(`/api/orders/${id}/send`, { method: "POST" });
      flash(`${res.sent} rida saadetud kööki`);
      return res.order;
    });
  }

  async function cancelOrder() {
    setCancelOpen(false);
    await mutate(async () => {
      const o = await api<OrderDto>(`/api/orders/${id}`, { method: "PUT", json: { status: "cancelled" } });
      router.push("/");
      return o;
    });
  }

  const totals = useMemo(() => calcTotals(order?.items ?? []), [order]);
  const itemCount = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const newCount = order?.items.filter((i) => i.kitchenStatus === "new").length ?? 0;
  const visibleCategories = (categories ?? []).filter((c) => products?.some((p) => p.categoryId === c.id));

  if (error && !order) return <ErrorBanner message={error} onRetry={load} />;
  if (!order || !categories || !products) return <Loading />;

  if (order.status === "cancelled") {
    return (
      <div className="mx-auto max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
        <XCircle className="mx-auto size-12 text-slate-400" />
        <h1 className="mt-3 text-xl font-bold">Tellimus on tühistatud</h1>
        <Button asChild className="mt-6">
          <Link href="/">Tagasi laudadesse</Link>
        </Button>
      </div>
    );
  }
  if (order.status === "paid") return <Loading label="Avan tšekki…" />;

  const locked = order.paid > 0;

  return (
    <div className="pb-24 lg:pb-0">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="Tagasi laudadesse">
          <Link href="/">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{order.tableName}</h1>
        <span className="text-sm text-slate-500">Tellimus #{order.id}</span>
        {pending > 0 && <Loader2 className="size-5 animate-spin text-slate-400" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* Products */}
        <section className="min-w-0">
          {visibleCategories.length === 0 ? (
            <div className="rounded-lg bg-white p-8 text-center text-slate-500 shadow-sm">
              Menüüs pole aktiivseid tooteid.{" "}
              <Link href="/menu" className="font-semibold text-emerald-700 underline">
                Lisa tooteid
              </Link>
            </div>
          ) : (
            <Tabs defaultValue={String(visibleCategories[0].id)}>
              <TabsList>
                {visibleCategories.map((c) => (
                  <TabsTrigger key={c.id} value={String(c.id)}>
                    {c.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {visibleCategories.map((c) => (
                <TabsContent key={c.id} value={String(c.id)}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
                    {products
                      .filter((p) => p.categoryId === c.id)
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => addProduct(p)}
                          disabled={locked}
                          className="flex min-h-24 flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:border-emerald-400 hover:shadow-md active:scale-[0.97] active:bg-emerald-50 disabled:opacity-50"
                        >
                          <span className="font-semibold leading-snug text-slate-800">{p.name}</span>
                          <span className="tabular mt-2 text-lg font-bold text-slate-900">{formatEur(p.price)}</span>
                        </button>
                      ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </section>

        {/* Cart */}
        <aside
          ref={cartRef}
          className="flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <ShoppingCart className="size-5 text-slate-500" />
            <h2 className="text-lg font-bold">Tellimus</h2>
            <span className="ml-auto text-sm text-slate-500">{itemCount} tk</span>
          </div>

          <div className="min-h-32 flex-1 overflow-y-auto">
            {order.items.length === 0 ? (
              <p className="p-8 text-center text-slate-400">Vali vasakult tooted, et need tellimusse lisada.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {order.items.map((item) => {
                  const st = statusLabel[item.kitchenStatus];
                  return (
                    <li key={item.id} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold leading-snug">{item.productName}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            <span className="tabular">{formatEur(item.unitPrice)}</span>
                            <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", st.className)}>{st.text}</span>
                          </div>
                          {item.note && <div className="mt-1 text-sm italic text-amber-700">„{item.note}“</div>}
                        </div>
                        <div className="tabular text-right text-lg font-bold">{formatEur(item.unitPrice * item.quantity)}</div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="icon"
                          aria-label="Vähenda kogust"
                          disabled={locked || item.quantity <= 1}
                          onClick={() => setQty(item, item.quantity - 1)}
                        >
                          <Minus />
                        </Button>
                        <span className="tabular w-10 text-center text-xl font-bold">{item.quantity}</span>
                        <Button
                          variant="secondary"
                          size="icon"
                          aria-label="Suurenda kogust"
                          disabled={locked}
                          onClick={() => setQty(item, item.quantity + 1)}
                        >
                          <Plus />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto"
                          aria-label="Märkus"
                          disabled={locked}
                          onClick={() => {
                            setNoteItem(item);
                            setNoteText(item.note ?? "");
                          }}
                        >
                          <MessageSquare className={cn(item.note && "text-amber-600")} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:bg-red-50"
                          aria-label="Eemalda rida"
                          disabled={locked}
                          onClick={() => removeItem(item)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Vahesumma (km-ta)</span>
              <span className="tabular">{formatEur(totals.net)}</span>
            </div>
            {totals.byRate.map((r) => (
              <div key={r.vatRate} className="flex justify-between text-sm text-slate-600">
                <span>Käibemaks {formatVatRate(r.vatRate)}</span>
                <span className="tabular">{formatEur(r.vat)}</span>
              </div>
            ))}
            {totals.byRate.length === 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>Käibemaks</span>
                <span className="tabular">{formatEur(0)}</span>
              </div>
            )}
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg font-bold">Kokku</span>
              <span className="tabular text-4xl font-bold tracking-tight">{formatEur(totals.total)}</span>
            </div>
            {order.paid > 0 && (
              <div className="flex justify-between text-sm font-semibold text-emerald-700">
                <span>Makstud</span>
                <span className="tabular">{formatEur(order.paid)}</span>
              </div>
            )}
          </div>

          {actionError && <ErrorBanner message={actionError} className="mx-3 mb-2" />}

          <div className="grid gap-2 p-3">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="lg" disabled={newCount === 0 || pending > 0} onClick={sendToKitchen}>
                <ChefHat /> Saada kööki
              </Button>
              <Button
                variant="primary"
                size="lg"
                disabled={order.items.length === 0 || pending > 0}
                onClick={() => setPayOpen(true)}
              >
                <Wallet /> Maksa
              </Button>
            </div>
            <Button
              variant="outlineDestructive"
              disabled={locked || pending > 0}
              onClick={() => (order.items.length === 0 ? cancelOrder() : setCancelOpen(true))}
            >
              <XCircle /> Tühista tellimus
            </Button>
            {locked && (
              <p className="text-center text-xs text-slate-500">Tellimus on osaliselt makstud – muutmine pole võimalik.</p>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden print:hidden">
        <div className="flex items-center gap-3">
          <button
            className="flex-1 text-left"
            onClick={() => cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <div className="text-xs text-slate-500">{itemCount} toodet · vaata tellimust</div>
            <div className="tabular text-2xl font-bold">{formatEur(totals.total)}</div>
          </button>
          <Button variant="primary" size="lg" disabled={order.items.length === 0 || pending > 0} onClick={() => setPayOpen(true)}>
            <Wallet /> Maksa
          </Button>
        </div>
      </div>

      <PaymentDialog
        order={order}
        open={payOpen}
        onOpenChange={setPayOpen}
        onUpdated={setOrder}
        onPaid={(o, change, received) => {
          const q = new URLSearchParams();
          if (received > 0) q.set("received", String(received));
          if (change > 0) q.set("change", String(change));
          router.push(`/receipt/${o.id}${q.size ? `?${q}` : ""}`);
        }}
      />

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tühista tellimus?</DialogTitle>
            <DialogDescription>
              {order.tableName} tellimus ({formatEur(totals.total)}) tühistatakse ja laud vabaneb.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Ei
            </Button>
            <Button variant="destructive" onClick={cancelOrder}>
              Jah, tühista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!noteItem} onOpenChange={(o) => !o && setNoteItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Märkus</DialogTitle>
            <DialogDescription>{noteItem?.productName}</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (noteItem) saveNote(noteItem, noteText);
              setNoteItem(null);
            }}
          >
            <Input
              autoFocus
              maxLength={200}
              placeholder="nt ilma sibulata"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {["ilma sibulata", "gluteenivaba", "laktoosivaba", "vürtsikas", "kaasa"].map((s) => (
                <Button key={s} type="button" variant="secondary" size="sm" onClick={() => setNoteText(s)}>
                  {s}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setNoteText("")}>
                Tühjenda
              </Button>
              <Button type="submit">Salvesta</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Toast message={toast} />
    </div>
  );
}
