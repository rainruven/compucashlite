import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, loadOrder, parseId, requireOpenOrder, route, serializeOrder } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Sends all new (unsent) lines of the order to the kitchen. */
export const POST = route(async (_req, { params }: Ctx) => {
  const orderId = parseId((await params).id);
  const sent = await prisma.$transaction(async (tx) => {
    await requireOpenOrder(orderId, tx);
    const { count } = await tx.orderItem.updateMany({
      where: { orderId, kitchenStatus: "new" },
      data: { kitchenStatus: "sent", sentAt: new Date() },
    });
    return count;
  });
  if (sent === 0) throw badRequest("Pole uusi ridu, mida kööki saata.");
  return NextResponse.json({ sent, order: serializeOrder(await loadOrder(orderId)) });
});
