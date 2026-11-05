import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  badRequest,
  loadOrder,
  notFound,
  parseId,
  readJson,
  recalcTotal,
  requireOpenOrder,
  route,
  serializeOrder,
} from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

function parseQuantity(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw badRequest("Kogus peab olema positiivne täisarv.");
  if (n > 999) throw badRequest("Kogus on liiga suur.");
  return n;
}

function parseNote(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw badRequest("Vigane märkus.");
  const s = value.trim();
  if (s.length > 200) throw badRequest("Märkus on liiga pikk (max 200 märki).");
  return s || null;
}

/**
 * Updates an order line: { quantity?, note? }.
 * If the line was already sent to the kitchen and the quantity grows, the extra
 * portions are added as a new (unsent) line so the kitchen gets them separately.
 */
export const PUT = route(async (req, { params }: Ctx) => {
  const p = await params;
  const orderId = parseId(p.id);
  const itemId = parseId(p.itemId);
  const body = await readJson(req);

  await prisma.$transaction(async (tx) => {
    await requireOpenOrder(orderId, tx);
    const item = await tx.orderItem.findFirst({ where: { id: itemId, orderId } });
    if (!item) throw notFound("Tellimuse rida ei leitud.");
    const data: { quantity?: number; note?: string | null } = {};
    if (body.note !== undefined) data.note = parseNote(body.note);
    if (body.quantity !== undefined) {
      const quantity = parseQuantity(body.quantity);
      if (item.kitchenStatus !== "new" && quantity > item.quantity) {
        const extra = quantity - item.quantity;
        const note = data.note !== undefined ? data.note : item.note;
        const pending = await tx.orderItem.findFirst({
          where: { orderId, productId: item.productId, productName: item.productName, note, kitchenStatus: "new" },
        });
        if (pending) {
          await tx.orderItem.update({ where: { id: pending.id }, data: { quantity: pending.quantity + extra } });
        } else {
          await tx.orderItem.create({
            data: {
              orderId,
              productId: item.productId,
              productName: item.productName,
              unitPrice: item.unitPrice,
              vatRate: item.vatRate,
              quantity: extra,
              note,
            },
          });
        }
      } else {
        data.quantity = quantity;
      }
    }
    if (Object.keys(data).length) await tx.orderItem.update({ where: { id: itemId }, data });
    await recalcTotal(orderId, tx);
  });
  return NextResponse.json(serializeOrder(await loadOrder(orderId)));
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  const p = await params;
  const orderId = parseId(p.id);
  const itemId = parseId(p.itemId);
  await prisma.$transaction(async (tx) => {
    await requireOpenOrder(orderId, tx);
    const { count } = await tx.orderItem.deleteMany({ where: { id: itemId, orderId } });
    if (!count) throw notFound("Tellimuse rida ei leitud.");
    await recalcTotal(orderId, tx);
  });
  return NextResponse.json(serializeOrder(await loadOrder(orderId)));
});
