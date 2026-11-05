import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, loadOrder, parseId, readJson, requireOpenOrder, route, serializeOrder } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, { params }: Ctx) => {
  const id = parseId((await params).id);
  return NextResponse.json(serializeOrder(await loadOrder(id)));
});

/** Updates an order. Supported: { status: "cancelled" } or { tableId } (move to another table). */
export const PUT = route(async (req, { params }: Ctx) => {
  const id = parseId((await params).id);
  const body = await readJson(req);
  await prisma.$transaction(async (tx) => {
    await requireOpenOrder(id, tx);
    if (body.status !== undefined) {
      if (body.status !== "cancelled") throw badRequest("Tellimust saab siin ainult tühistada; maksmiseks kasuta makset.");
      const payments = await tx.payment.count({ where: { orderId: id } });
      if (payments > 0) throw badRequest("Osaliselt makstud tellimust ei saa tühistada.");
      await tx.order.update({ where: { id }, data: { status: "cancelled" } });
    }
    if (body.tableId !== undefined) {
      const tableId = parseId(body.tableId, "laua ID");
      await tx.diningTable.findUniqueOrThrow({ where: { id: tableId } });
      await tx.order.update({ where: { id }, data: { tableId } });
    }
  });
  return NextResponse.json(serializeOrder(await loadOrder(id)));
});
