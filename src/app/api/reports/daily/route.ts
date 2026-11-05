import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromCents, toCents, vatFromGrossCents } from "@/lib/money";
import { badRequest, route } from "@/lib/server";
import { dayBounds, localHour, todayLocal } from "@/lib/time";
import type { DailyReportDto, PaymentMethod, ReportLine } from "@/lib/types";

export const dynamic = "force-dynamic";

type Acc = { quantity: number; cents: number };

function add(map: Map<string, Acc>, key: string, quantity: number, cents: number) {
  const a = map.get(key) ?? { quantity: 0, cents: 0 };
  a.quantity += quantity;
  a.cents += cents;
  map.set(key, a);
}

const toLines = (map: Map<string, Acc>): ReportLine[] =>
  [...map.entries()].map(([name, a]) => ({ name, quantity: a.quantity, amount: fromCents(a.cents) }));

/** Daily Z-report: GET /api/reports/daily?date=YYYY-MM-DD (default today, Tallinn time). */
export const GET = route(async (req) => {
  const date = new URL(req.url).searchParams.get("date") || todayLocal();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))
    throw badRequest("Kuupäev peab olema kujul AAAA-KK-PP.");
  const [start, end] = dayBounds(date);

  const orders = await prisma.order.findMany({
    where: { status: "paid", paidAt: { gte: start, lt: end } },
    include: { items: { include: { product: { include: { category: true } } } }, payments: true },
  });

  let totalCents = 0;
  const byMethod = new Map<PaymentMethod, number>([
    ["cash", 0],
    ["card", 0],
  ]);
  const byCategory = new Map<string, Acc>();
  const byProduct = new Map<string, Acc>();
  const byVat = new Map<number, number>();
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, cents: 0, receipts: 0 }));

  for (const o of orders) {
    const orderCents = toCents(o.total);
    totalCents += orderCents;
    const h = byHour[localHour(o.paidAt!)];
    h.cents += orderCents;
    h.receipts++;
    for (const p of o.payments) {
      const m = p.method as PaymentMethod;
      byMethod.set(m, (byMethod.get(m) ?? 0) + toCents(p.amount));
    }
    for (const i of o.items) {
      const cents = toCents(i.unitPrice) * i.quantity;
      add(byCategory, i.product?.category.name ?? "Muu", i.quantity, cents);
      add(byProduct, i.productName, i.quantity, cents);
      const rate = Number(i.vatRate);
      byVat.set(rate, (byVat.get(rate) ?? 0) + cents);
    }
  }

  const products = toLines(byProduct);
  const report: DailyReportDto = {
    date,
    receiptCount: orders.length,
    totalSales: fromCents(totalCents),
    byPaymentMethod: [...byMethod.entries()].map(([method, c]) => ({ method, amount: fromCents(c) })),
    byCategory: toLines(byCategory).sort((a, b) => b.amount - a.amount),
    topByQuantity: [...products].sort((a, b) => b.quantity - a.quantity || b.amount - a.amount).slice(0, 10),
    topByRevenue: [...products].sort((a, b) => b.amount - a.amount || b.quantity - a.quantity).slice(0, 10),
    vatSummary: [...byVat.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([vatRate, gross]) => {
        const vat = vatFromGrossCents(gross, vatRate);
        return { vatRate, gross: fromCents(gross), vat: fromCents(vat), net: fromCents(gross - vat) };
      }),
    byHour: byHour.map((h) => ({ hour: h.hour, amount: fromCents(h.cents), receipts: h.receipts })),
  };
  return NextResponse.json(report);
});
