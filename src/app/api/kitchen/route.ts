import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, parseId, readJson, route, serializeItem } from "@/lib/server";
import type { KitchenOrderDto, OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Orders with lines sent to the kitchen during the last 24 hours, newest first. */
export const GET = route(async () => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: {
      status: { not: "cancelled" },
      items: { some: { kitchenStatus: { in: ["sent", "ready"] }, sentAt: { gte: since } } },
    },
    include: {
      table: true,
      items: {
        where: { kitchenStatus: { in: ["sent", "ready"] }, sentAt: { gte: since } },
        orderBy: [{ sentAt: "desc" }, { id: "asc" }],
      },
    },
  });
  const result: KitchenOrderDto[] = orders
    .map((o) => ({
      id: o.id,
      tableName: o.table.name,
      status: o.status as OrderStatus,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map(serializeItem),
    }))
    .sort((a, b) => (b.items[0]?.sentAt ?? "").localeCompare(a.items[0]?.sentAt ?? ""));
  return NextResponse.json(result);
});

/** Marks kitchen work done: { itemId } for one line or { orderId } for all sent lines of an order. */
export const PUT = route(async (req) => {
  const body = await readJson(req);
  const status = body.status === undefined ? "ready" : body.status;
  if (status !== "ready" && status !== "sent") throw badRequest("Vigane staatus.");
  const from = status === "ready" ? "sent" : "ready";
  if (body.itemId !== undefined) {
    const itemId = parseId(body.itemId, "rea ID");
    const { count } = await prisma.orderItem.updateMany({
      where: { id: itemId, kitchenStatus: from },
      data: { kitchenStatus: status },
    });
    return NextResponse.json({ updated: count });
  }
  if (body.orderId !== undefined) {
    const orderId = parseId(body.orderId, "tellimuse ID");
    const { count } = await prisma.orderItem.updateMany({
      where: { orderId, kitchenStatus: from },
      data: { kitchenStatus: status },
    });
    return NextResponse.json({ updated: count });
  }
  throw badRequest("Määra itemId või orderId.");
});
