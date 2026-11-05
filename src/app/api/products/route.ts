import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  notFound,
  parseId,
  parseMoney,
  parseVatRate,
  readJson,
  requireString,
  route,
  serializeProduct,
} from "@/lib/server";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const params = new URL(req.url).searchParams;
  const activeOnly = params.get("active") === "1";
  const products = await prisma.product.findMany({
    where: activeOnly ? { active: true, category: { active: true } } : undefined,
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    include: { category: true },
  });
  return NextResponse.json(products.map(serializeProduct));
});

export const POST = route(async (req) => {
  const body = await readJson(req);
  const name = requireString(body.name, "Toote nimi", 120);
  const categoryId = parseId(body.categoryId, "kategooria");
  const price = parseMoney(body.price, "Hind");
  const vatRate = parseVatRate(body.vatRate);
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw notFound("Kategooriat ei leitud.");
  const product = await prisma.product.create({
    data: { name, categoryId, price, vatRate, active: body.active === undefined ? true : Boolean(body.active) },
    include: { category: true },
  });
  return NextResponse.json(serializeProduct(product), { status: 201 });
});
