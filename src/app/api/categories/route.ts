import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readJson, requireString, route, serializeCategory } from "@/lib/server";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const activeOnly = new URL(req.url).searchParams.get("active") === "1";
  const categories = await prisma.category.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json(categories.map(serializeCategory));
});

export const POST = route(async (req) => {
  const body = await readJson(req);
  const name = requireString(body.name, "Kategooria nimi", 80);
  const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const sortOrder = Number.isInteger(body.sortOrder) ? (body.sortOrder as number) : (max._max.sortOrder ?? 0) + 1;
  const category = await prisma.category.create({
    data: { name, sortOrder, active: body.active === undefined ? true : Boolean(body.active) },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json(serializeCategory(category), { status: 201 });
});
