import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, parseId, readJson, requireString, route, serializeCategory } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route(async (req, { params }: Ctx) => {
  const id = parseId((await params).id);
  const body = await readJson(req);
  const data: { name?: string; sortOrder?: number; active?: boolean } = {};
  if (body.name !== undefined) data.name = requireString(body.name, "Kategooria nimi", 80);
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isInteger(n)) throw badRequest("Järjekord peab olema täisarv.");
    data.sortOrder = n;
  }
  if (body.active !== undefined) data.active = Boolean(body.active);
  const category = await prisma.category.update({
    where: { id },
    data,
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json(serializeCategory(category));
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  const id = parseId((await params).id);
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0)
    throw badRequest(`Kategoorias on ${count} toodet. Kustuta või tõsta tooted enne kategooria kustutamist ümber.`);
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
