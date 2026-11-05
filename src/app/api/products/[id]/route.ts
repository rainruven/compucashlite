import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  parseId,
  parseMoney,
  parseVatRate,
  readJson,
  requireString,
  route,
  serializeProduct,
} from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, { params }: Ctx) => {
  const id = parseId((await params).id);
  const product = await prisma.product.findUniqueOrThrow({ where: { id }, include: { category: true } });
  return NextResponse.json(serializeProduct(product));
});

export const PUT = route(async (req, { params }: Ctx) => {
  const id = parseId((await params).id);
  const body = await readJson(req);
  const data: { name?: string; categoryId?: number; price?: number; vatRate?: number; active?: boolean } = {};
  if (body.name !== undefined) data.name = requireString(body.name, "Toote nimi", 120);
  if (body.categoryId !== undefined) data.categoryId = parseId(body.categoryId, "kategooria");
  if (body.price !== undefined) data.price = parseMoney(body.price, "Hind");
  if (body.vatRate !== undefined) data.vatRate = parseVatRate(body.vatRate);
  if (body.active !== undefined) data.active = Boolean(body.active);
  const product = await prisma.product.update({ where: { id }, data, include: { category: true } });
  return NextResponse.json(serializeProduct(product));
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  const id = parseId((await params).id);
  // Order lines keep their own name and price, so past receipts stay intact.
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
