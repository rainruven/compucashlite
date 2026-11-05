"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, ChevronLeft, ChevronRight, CreditCard, Printer, Receipt, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorBanner, Loading, PageHeader } from "@/components/feedback";
import { api, errorMessage } from "@/lib/client";
import { formatEur, formatVatRate } from "@/lib/money";
import { todayLocal } from "@/lib/time";
import type { DailyReportDto, ReportLine } from "@/lib/types";

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm print:break-inside-avoid print:shadow-none ${className ?? ""}`}>
      <h2 className="border-b border-slate-100 px-4 py-3 text-lg font-bold">{title}</h2>
      <div className="p-2 sm:p-3">{children}</div>
    </section>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Receipt; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:shadow-none">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <span className={`flex size-8 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="size-4" />
        </span>
        {label}
      </div>
      <div className="tabular mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{value}</div>
    </div>
  );
}

function LinesTable({ lines, empty }: { lines: ReportLine[]; empty: string }) {
  if (lines.length === 0) return <p className="p-4 text-center text-slate-400">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nimetus</TableHead>
          <TableHead className="text-right">Kogus</TableHead>
          <TableHead className="text-right">Summa</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((l) => (
          <TableRow key={l.name}>
            <TableCell className="font-medium">{l.name}</TableCell>
            <TableCell className="tabular text-right">{l.quantity}</TableCell>
            <TableCell className="tabular text-right font-semibold">{formatEur(l.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ReportsPage() {
  const [date, setDate] = useState<string>("");
  const [report, setReport] = useState<DailyReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setLoading(true);
    try {
      setReport(await api<DailyReportDto>(`/api/reports/daily?date=${date}`));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    setDate(todayLocal());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hours = report?.byHour ?? [];
  const activeHours = hours.filter((h) => h.amount > 0);
  const firstHour = activeHours.length ? Math.min(8, activeHours[0].hour) : 8;
  const lastHour = activeHours.length ? Math.max(22, activeHours[activeHours.length - 1].hour) : 22;
  const chartHours = hours.filter((h) => h.hour >= firstHour && h.hour <= lastHour);
  const maxHour = Math.max(1, ...chartHours.map((h) => h.amount));
  const cash = report?.byPaymentMethod.find((m) => m.method === "cash")?.amount ?? 0;
  const card = report?.byPaymentMethod.find((m) => m.method === "card")?.amount ?? 0;
  const vatTotals = (report?.vatSummary ?? []).reduce(
    (s, v) => ({ net: s.net + v.net, vat: s.vat + v.vat, gross: s.gross + v.gross }),
    { net: 0, vat: 0, gross: 0 },
  );

  return (
    <div>
      <PageHeader title="Päevaaruanne (Z)">
        <div className="flex items-center gap-1 print:hidden">
          <Button variant="secondary" size="icon" aria-label="Eelmine päev" onClick={() => setDate((d) => shiftDate(d || todayLocal(), -1))}>
            <ChevronLeft />
          </Button>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" aria-label="Kuupäev" />
          <Button variant="secondary" size="icon" aria-label="Järgmine päev" onClick={() => setDate((d) => shiftDate(d || todayLocal(), 1))}>
            <ChevronRight />
          </Button>
          <Button variant="secondary" onClick={() => setDate(todayLocal())}>
            Täna
          </Button>
        </div>
        <Button variant="secondary" className="print:hidden" onClick={() => window.print()}>
          <Printer /> Prindi
        </Button>
      </PageHeader>
      <p className="-mt-3 mb-4 hidden text-slate-600 print:block">Kuupäev: {date && formatDate(date)}</p>

      {error && <ErrorBanner message={error} onRetry={load} className="mb-4" />}
      {!report && !error && <Loading />}

      {report && (
        <div className={`grid gap-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={TrendingUp} label="Müük kokku" value={formatEur(report.totalSales)} accent="bg-emerald-100 text-emerald-700" />
            <Stat icon={Receipt} label="Tšekke" value={String(report.receiptCount)} accent="bg-slate-100 text-slate-700" />
            <Stat icon={Banknote} label="Sularaha" value={formatEur(cash)} accent="bg-amber-100 text-amber-700" />
            <Stat icon={CreditCard} label="Kaart" value={formatEur(card)} accent="bg-sky-100 text-sky-700" />
          </div>

          <Card title="Müük tundide kaupa">
            {activeHours.length === 0 ? (
              <p className="p-4 text-center text-slate-400">Sellel päeval müüki ei olnud.</p>
            ) : (
              <div className="flex h-56 items-end gap-1 px-1 pt-6 sm:gap-2">
                {chartHours.map((h) => (
                  <div key={h.hour} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                    <div className="tabular mb-1 hidden text-[10px] font-semibold text-slate-600 group-hover:block sm:text-xs">
                      {h.amount > 0 ? formatEur(h.amount) : ""}
                    </div>
                    <div
                      className="w-full rounded-t-md bg-emerald-500 transition-all group-hover:bg-emerald-600"
                      style={{ height: `${(h.amount / maxHour) * 100}%`, minHeight: h.amount > 0 ? 4 : 0 }}
                      title={`${h.hour}:00 – ${formatEur(h.amount)} (${h.receipts} tšekki)`}
                    />
                    <div className="tabular mt-1 text-[10px] text-slate-500 sm:text-xs">{h.hour}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Müük kategooriate kaupa">
              <LinesTable lines={report.byCategory} empty="Andmed puuduvad" />
            </Card>
            <Card title="Käibemaksu kokkuvõte">
              {report.vatSummary.length === 0 ? (
                <p className="p-4 text-center text-slate-400">Andmed puuduvad</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>KM määr</TableHead>
                      <TableHead className="text-right">Neto</TableHead>
                      <TableHead className="text-right">KM</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.vatSummary.map((v) => (
                      <TableRow key={v.vatRate}>
                        <TableCell className="font-medium">{formatVatRate(v.vatRate)}</TableCell>
                        <TableCell className="tabular text-right">{formatEur(v.net)}</TableCell>
                        <TableCell className="tabular text-right">{formatEur(v.vat)}</TableCell>
                        <TableCell className="tabular text-right font-semibold">{formatEur(v.gross)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>Kokku</TableCell>
                      <TableCell className="tabular text-right">{formatEur(vatTotals.net)}</TableCell>
                      <TableCell className="tabular text-right">{formatEur(vatTotals.vat)}</TableCell>
                      <TableCell className="tabular text-right">{formatEur(vatTotals.gross)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </Card>
            <Card title="TOP 10 – kogus">
              <LinesTable lines={report.topByQuantity} empty="Andmed puuduvad" />
            </Card>
            <Card title="TOP 10 – käive">
              <LinesTable lines={report.topByRevenue} empty="Andmed puuduvad" />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
