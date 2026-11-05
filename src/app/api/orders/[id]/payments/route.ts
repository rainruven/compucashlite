import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromCents, toCents } from "@/lib/money";
import { badRequest, loadOrder, parseId, parseMoney, readJson, requireOpenOrder, route, serializeOrder } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Registers a payment: { method: "cash" | "card", amount }.
 * Cash may exceed the remaining amount (change is returned); card may not.
 * When the order is fully paid it is closed, gets a receipt number and the table becomes free.
 */
export const POST = route(async (req, { params }: Ctx) => {
  const orderId = parseId((await params).id);
  const body = await readJson(req);
  const method = body.method;
  if (method !== "cash" && method !== "card") throw badRequest("Makseviis peab olema sularaha või kaart.");
  const amountCents = toCents(parseMoney(body.amount, "Summa"));
  if (amountCents <= 0) throw badRequest("Summa peab olema suurem kui 0.");

  const result = await prisma.$transaction(async (tx) => {
    const order = await requireOpenOrder(orderId, tx);
    const itemCount = await tx.orderItem.count({ where: { orderId } });
    if (itemCount === 0) throw badRequest("Tühja tellimust ei saa maksta.");
    const totalCents = toCents(order.total);
    const paid = await tx.payment.aggregate({ where: { orderId }, _sum: { amount: true } });
    const remainingCents = totalCents - toCents(paid._sum.amount ?? 0);
    if (remainingCents <= 0) throw badRequest("Tellimus on juba makstud.");
    if (method === "card" && amountCents > remainingCents)
      throw badRequest("Kaardimakse ei tohi ületada tasumata summat.");

    const appliedCents = Math.min(amountCents, remainingCents);
    const changeCents = amountCents - appliedCents;
    await tx.payment.create({ data: { orderId, method, amount: fromCents(appliedCents) } });

    const fullyPaid = appliedCents === remainingCents;
    if (fullyPaid) {
      const max = await tx.order.aggregate({ _max: { receiptNo: true } });
      await tx.order.update({
        where: { id: orderId },
        data: { status: "paid", paidAt: new Date(), receiptNo: (max._max.receiptNo ?? 0) + 1 },
      });
    }
    return { change: fromCents(changeCents), fullyPaid, remaining: fromCents(remainingCents - appliedCents) };
  });

  return NextResponse.json({ ...result, order: serializeOrder(await loadOrder(orderId)) }, { status: 201 });
});
