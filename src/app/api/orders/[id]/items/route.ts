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

type Ctx = { params: Promise<{ id: string }> };

function parseQuantity(value: unknown, allowZero = false): number {
  const n = value === undefined ? 1 : Number(value);
  if (!Number.isInteger(n) || n < (allowZero ? 0 : 1)) throw badRequest("Kogus peab olema positiivne täisarv.");
  if (n > 999) throw badRequest("Kogus on liiga suur.");
  return n;
}

function parseNote(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw badRequest("Vigane märkus.");
  const s = value.trim();
  if (s.length > 200) throw badRequest("Märkus on liiga pikk (max 200 märki).");
  return s || null;
}

/** Adds a product to the order. Same product without a note (not yet sent) is merged into one line. */
export const POST = route(async (req, { params }: Ctx) => {
  const orderId = parseId((await params).id);
  const body = await readJson(req);
  const productId = parseId(body.productId, "toote ID");
  const quantity = parseQuantity(body.quantity);
  const note = parseNote(body.note);

  await prisma.$transaction(async (tx) => {
    await requireOpenOrder(orderId, tx);
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw notFound("Toodet ei leitud.");
    if (!product.active) throw badRequest("Toode ei ole müügis.");
    const mergeWith = note
      ? null
      : await tx.orderItem.findFirst({
          where: { orderId, productId, note: null, kitchenStatus: "new", unitPrice: product.price },
        });
    if (mergeWith) {
      await tx.orderItem.update({ where: { id: mergeWith.id }, data: { quantity: mergeWith.quantity + quantity } });
    } else {
      await tx.orderItem.create({
        data: {
          orderId,
          productId,
          productName: product.name,
          unitPrice: product.price,
          vatRate: product.vatRate,
          quantity,
          note,
        },
      });
    }
    await recalcTotal(orderId, tx);
  });
  return NextResponse.json(serializeOrder(await loadOrder(orderId)), { status: 201 });
});
