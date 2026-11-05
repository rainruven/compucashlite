"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, FileUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorBanner, Loading, PageHeader, Toast } from "@/components/feedback";
import { api, errorMessage } from "@/lib/client";
import { formatEur, formatVatRate, parseAmount } from "@/lib/money";
import type { CategoryDto, ProductDto } from "@/lib/types";
import { cn } from "@/lib/utils";

type ProductForm = { id?: number; name: string; categoryId: string; price: string; vatRate: string; active: boolean };
type CategoryForm = { id?: number; name: string; sortOrder: string; active: boolean };
type Confirm = { title: string; text: string; action: () => Promise<void> };

const decimalText = (n: number) => String(n).replace(".", ",");

export default function MenuPage() {
  const [categories, setCategories] = useState<CategoryDto[] | null>(null);
  const [products, setProducts] = useState<ProductDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [productForm, setProductForm] = useState<ProductForm | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([api<CategoryDto[]>("/api/categories"), api<ProductDto[]>("/api/products")]);
      setCategories(c);
      setProducts(p);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function flash(msg: string, tone: "success" | "error" = "success") {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2500);
  }

  async function run(fn: () => Promise<unknown>, success: string) {
    try {
      await fn();
      flash(success);
    } catch (e) {
      flash(errorMessage(e), "error");
    }
    await load();
  }

  async function saveProduct() {
    if (!productForm) return;
    const price = parseAmount(productForm.price);
    const vatRate = parseAmount(productForm.vatRate);
    if (!productForm.name.trim()) return setFormError("Sisesta toote nimi.");
    if (!productForm.categoryId) return setFormError("Vali kategooria.");
    if (!Number.isFinite(price) || price < 0) return setFormError("Hind peab olema 0 või suurem number.");
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) return setFormError("Käibemaksumäär peab olema 0–100.");
    setSaving(true);
    setFormError(null);
    try {
      const json = {
        name: productForm.name,
        categoryId: Number(productForm.categoryId),
        price,
        vatRate,
        active: productForm.active,
      };
      if (productForm.id) await api(`/api/products/${productForm.id}`, { method: "PUT", json });
      else await api("/api/products", { method: "POST", json });
      setProductForm(null);
      flash("Toode salvestatud");
      await load();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory() {
    if (!categoryForm) return;
    if (!categoryForm.name.trim()) return setFormError("Sisesta kategooria nimi.");
    const sortOrder = Number(categoryForm.sortOrder);
    if (categoryForm.sortOrder !== "" && !Number.isInteger(sortOrder)) return setFormError("Järjekord peab olema täisarv.");
    setSaving(true);
    setFormError(null);
    try {
      const json = {
        name: categoryForm.name,
        active: categoryForm.active,
        ...(categoryForm.sortOrder !== "" ? { sortOrder } : {}),
      };
      if (categoryForm.id) await api(`/api/categories/${categoryForm.id}`, { method: "PUT", json });
      else await api("/api/categories", { method: "POST", json });
      setCategoryForm(null);
      flash("Kategooria salvestatud");
      await load();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function importCsv(file: File) {
    try {
      const text = await file.text();
      const res = await api<{ created: number; updated: number; errors: string[] }>("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "text/csv; charset=utf-8" },
        body: text,
      });
      setImportResult(res);
      await load();
    } catch (e) {
      flash(errorMessage(e), "error");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (error && !categories) return <ErrorBanner message={error} onRetry={load} />;
  if (!categories || !products) return <Loading />;

  const q = search.trim().toLowerCase();
  const shown = products.filter(
    (p) => (filter === "all" || String(p.categoryId) === filter) && (!q || p.name.toLowerCase().includes(q)),
  );

  return (
    <div>
      <PageHeader title="Menüü">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
        />
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          <FileUp /> Impordi CSV
        </Button>
        <Button
          variant="primary"
          disabled={categories.length === 0}
          onClick={() => {
            setFormError(null);
            setProductForm({
              name: "",
              categoryId: filter !== "all" ? filter : String(categories[0]?.id ?? ""),
              price: "",
              vatRate: "24",
              active: true,
            });
          }}
        >
          <Plus /> Lisa toode
        </Button>
      </PageHeader>

      {error && <ErrorBanner message={error} onRetry={load} className="mb-4" />}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Categories */}
        <section className="h-fit rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-lg font-bold">Kategooriad</h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setFormError(null);
                setCategoryForm({ name: "", sortOrder: "", active: true });
              }}
            >
              <Plus /> Lisa
            </Button>
          </div>
          <ul className="divide-y divide-slate-100">
            <li>
              <button
                className={cn(
                  "flex min-h-12 w-full items-center px-4 text-left font-medium hover:bg-slate-50",
                  filter === "all" && "bg-slate-100 font-bold",
                )}
                onClick={() => setFilter("all")}
              >
                Kõik tooted <span className="ml-auto text-sm text-slate-500">{products.length}</span>
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.id} className={cn("flex items-center", filter === String(c.id) && "bg-slate-100")}>
                <button
                  className={cn(
                    "flex min-h-12 flex-1 items-center gap-2 px-4 text-left font-medium",
                    !c.active && "text-slate-400 line-through",
                    filter === String(c.id) && "font-bold",
                  )}
                  onClick={() => setFilter(String(c.id))}
                >
                  {c.name}
                  <span className="ml-auto text-sm font-normal text-slate-500 no-underline">{c.productCount ?? 0}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={c.active ? "Deaktiveeri" : "Aktiveeri"}
                  onClick={() =>
                    run(
                      () => api(`/api/categories/${c.id}`, { method: "PUT", json: { active: !c.active } }),
                      c.active ? "Kategooria peidetud" : "Kategooria aktiveeritud",
                    )
                  }
                >
                  {c.active ? <Eye /> : <EyeOff className="text-slate-400" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Muuda"
                  onClick={() => {
                    setFormError(null);
                    setCategoryForm({ id: c.id, name: c.name, sortOrder: String(c.sortOrder), active: c.active });
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600 hover:bg-red-50"
                  aria-label="Kustuta"
                  onClick={() =>
                    setConfirm({
                      title: "Kustuta kategooria?",
                      text: `Kategooria „${c.name}“ kustutatakse jäädavalt.`,
                      action: () =>
                        run(async () => {
                          await api(`/api/categories/${c.id}`, { method: "DELETE" });
                          if (filter === String(c.id)) setFilter("all");
                        }, "Kategooria kustutatud"),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </section>

        {/* Products */}
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 p-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Otsi toodet…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="p-8 text-center text-slate-500">Tooteid ei leitud.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nimi</TableHead>
                  <TableHead className="hidden sm:table-cell">Kategooria</TableHead>
                  <TableHead className="text-right">Hind</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">KM</TableHead>
                  <TableHead className="text-right">Tegevused</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((p) => (
                  <TableRow key={p.id} className={cn(!p.active && "text-slate-400")}>
                    <TableCell className="font-medium">
                      {p.name}
                      {!p.active && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                          Mitteaktiivne
                        </span>
                      )}
                      <div className="text-xs text-slate-500 sm:hidden">{p.categoryName}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{p.categoryName}</TableCell>
                    <TableCell className="tabular text-right font-semibold">{formatEur(p.price)}</TableCell>
                    <TableCell className="tabular hidden text-right sm:table-cell">{formatVatRate(p.vatRate)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={p.active ? "Deaktiveeri" : "Aktiveeri"}
                          onClick={() =>
                            run(
                              () => api(`/api/products/${p.id}`, { method: "PUT", json: { active: !p.active } }),
                              p.active ? "Toode deaktiveeritud" : "Toode aktiveeritud",
                            )
                          }
                        >
                          {p.active ? <Eye /> : <EyeOff />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Muuda"
                          onClick={() => {
                            setFormError(null);
                            setProductForm({
                              id: p.id,
                              name: p.name,
                              categoryId: String(p.categoryId),
                              price: decimalText(p.price),
                              vatRate: decimalText(p.vatRate),
                              active: p.active,
                            });
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:bg-red-50"
                          aria-label="Kustuta"
                          onClick={() =>
                            setConfirm({
                              title: "Kustuta toode?",
                              text: `Toode „${p.name}“ kustutatakse. Varasemad tšekid jäävad alles.`,
                              action: () => run(() => api(`/api/products/${p.id}`, { method: "DELETE" }), "Toode kustutatud"),
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      {/* Product dialog */}
      <Dialog open={!!productForm} onOpenChange={(o) => !o && setProductForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{productForm?.id ? "Muuda toodet" : "Lisa toode"}</DialogTitle>
            <DialogDescription>Hind sisaldab käibemaksu.</DialogDescription>
          </DialogHeader>
          {productForm && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveProduct();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="p-name">Nimi</Label>
                <Input
                  id="p-name"
                  autoFocus
                  maxLength={120}
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-cat">Kategooria</Label>
                <Select
                  id="p-cat"
                  value={productForm.categoryId}
                  onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="p-price">Hind koos KM-ga (€)</Label>
                  <Input
                    id="p-price"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="p-vat">Käibemaks (%)</Label>
                  <Input
                    id="p-vat"
                    inputMode="decimal"
                    value={productForm.vatRate}
                    onChange={(e) => setProductForm({ ...productForm, vatRate: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex min-h-12 items-center gap-3 font-medium">
                <input
                  type="checkbox"
                  className="size-5 accent-emerald-600"
                  checked={productForm.active}
                  onChange={(e) => setProductForm({ ...productForm, active: e.target.checked })}
                />
                Aktiivne (müügis)
              </label>
              {formError && <ErrorBanner message={formError} />}
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setProductForm(null)}>
                  Loobu
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  Salvesta
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Category dialog */}
      <Dialog open={!!categoryForm} onOpenChange={(o) => !o && setCategoryForm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{categoryForm?.id ? "Muuda kategooriat" : "Lisa kategooria"}</DialogTitle>
          </DialogHeader>
          {categoryForm && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveCategory();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="c-name">Nimi</Label>
                <Input
                  id="c-name"
                  autoFocus
                  maxLength={80}
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="c-sort">Järjekord</Label>
                <Input
                  id="c-sort"
                  inputMode="numeric"
                  placeholder="automaatne"
                  value={categoryForm.sortOrder}
                  onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: e.target.value })}
                />
              </div>
              <label className="flex min-h-12 items-center gap-3 font-medium">
                <input
                  type="checkbox"
                  className="size-5 accent-emerald-600"
                  checked={categoryForm.active}
                  onChange={(e) => setCategoryForm({ ...categoryForm, active: e.target.checked })}
                />
                Aktiivne
              </label>
              {formError && <ErrorBanner message={formError} />}
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setCategoryForm(null)}>
                  Loobu
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  Salvesta
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.text}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Loobu
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const c = confirm;
                setConfirm(null);
                await c?.action();
              }}
            >
              Kustuta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import result */}
      <Dialog open={!!importResult} onOpenChange={(o) => !o && setImportResult(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>CSV import</DialogTitle>
            <DialogDescription>Veerud: category,name,price,vat_rate</DialogDescription>
          </DialogHeader>
          {importResult && (
            <div className="grid gap-2">
              <p>
                Lisatud <b>{importResult.created}</b> toodet, uuendatud <b>{importResult.updated}</b>.
              </p>
              {importResult.errors.length > 0 && (
                <ul className="max-h-48 list-disc overflow-y-auto rounded-lg bg-red-50 p-3 pl-7 text-sm text-red-800">
                  {importResult.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setImportResult(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} />
    </div>
  );
}
