import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, loadOrder, notFound, orderInclude, parseId, readJson, route, serializeOrder } from "@/lib/server";
import { dayBounds } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Lists orders. Optional filters: ?status=open|paid|cancelled, ?tableId=, ?date=YYYY-MM-DD (by creation day). */
export const GET = route(async (req) => {
  const params = new URL(req.url).searchParams;
  const status = params.get("status");
  const tableId = params.get("tableId");
  const date = params.get("date");
  if (status && !["open", "paid", "cancelled"].includes(status)) throw badRequest("Vigane staatus.");
  let createdAt: { gte: Date; lt: Date } | undefined;
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest("Kuupäev peab olema kujul AAAA-KK-PP.");
    const [gte, lt] = dayBounds(date);
    createdAt = { gte, lt };
  }
  const orders = await prisma.order.findMany({
    where: {
      status: status ?? undefined,
      tableId: tableId ? parseId(tableId, "laua ID") : undefined,
      createdAt,
    },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(orders.map(serializeOrder));
});

/** Opens the table: returns its current open order, or creates a new one. */
export const POST = route(async (req) => {
  const body = await readJson(req);
  const tableId = parseId(body.tableId, "laua ID");
  const table = await prisma.diningTable.findUnique({ where: { id: tableId } });
  if (!table) throw notFound("Lauda ei leitud.");
  const existing = await prisma.order.findFirst({
    where: { tableId, status: "open" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return NextResponse.json(serializeOrder(await loadOrder(existing.id)));
  const order = await prisma.order.create({ data: { tableId }, include: orderInclude });
  return NextResponse.json(serializeOrder(order), { status: 201 });
});
