import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readJson, requireString, route, badRequest } from "@/lib/server";
import type { TableDto } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const tables = await prisma.diningTable.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      orders: {
        where: { status: "open" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { _count: { select: { items: true } } },
      },
    },
  });
  const result: TableDto[] = tables.map((t) => {
    const o = t.orders[0];
    return {
      id: t.id,
      name: t.name,
      seats: t.seats,
      sortOrder: t.sortOrder,
      openOrder: o
        ? { id: o.id, total: Number(o.total), itemCount: o._count.items, createdAt: o.createdAt.toISOString() }
        : null,
    };
  });
  return NextResponse.json(result);
});

export const POST = route(async (req) => {
  const body = await readJson(req);
  const name = requireString(body.name, "Laua nimi", 50);
  const seats = body.seats === undefined ? 4 : Number(body.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > 50) throw badRequest("Kohtade arv peab olema 1–50.");
  const max = await prisma.diningTable.aggregate({ _max: { sortOrder: true } });
  const table = await prisma.diningTable.create({
    data: { name, seats, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(table, { status: 201 });
});
