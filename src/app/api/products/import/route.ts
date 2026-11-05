import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { badRequest, route } from "@/lib/server";

export const dynamic = "force-dynamic";

/**
 * Imports products from CSV with columns: category,name,price,vat_rate.
 * Accepts either a raw CSV body (text/csv) or JSON { csv: "..." }.
 * Existing products (same category + name) get their price and VAT rate updated.
 */
export const POST = route(async (req) => {
  let text: string;
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const body = await req.json().catch(() => null);
    text = typeof body?.csv === "string" ? body.csv : "";
  } else {
    text = await req.text();
  }
  if (!text.trim()) throw badRequest("CSV fail on tühi.");
  if (text.length > 2_000_000) throw badRequest("CSV fail on liiga suur.");

  const rows = parseCsv(text);
  const header = (rows.shift() ?? []).map((h) => h.toLowerCase());
  const col = (n: string) => header.indexOf(n);
  const [ci, ni, pi, vi] = [col("category"), col("name"), col("price"), col("vat_rate")];
  if (ci < 0 || ni < 0 || pi < 0)
    throw badRequest("CSV päis peab sisaldama veerge: category,name,price,vat_rate");

  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  const categories = new Map((await prisma.category.findMany()).map((c) => [c.name.toLowerCase(), c]));
  let maxSort = Math.max(0, ...[...categories.values()].map((c) => c.sortOrder));

  for (const [index, r] of rows.entries()) {
    const line = index + 2;
    const categoryName = r[ci]?.trim();
    const name = r[ni]?.trim();
    const price = Number((r[pi] ?? "").replace(",", "."));
    const vatRaw = vi >= 0 ? (r[vi] ?? "").replace(",", ".").replace("%", "").trim() : "";
    const vatRate = vatRaw === "" ? 24 : Number(vatRaw);
    if (!categoryName || !name) {
      errors.push(`Rida ${line}: kategooria või nimi puudub`);
      continue;
    }
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Rida ${line}: vigane hind "${r[pi] ?? ""}"`);
      continue;
    }
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
      errors.push(`Rida ${line}: vigane käibemaksumäär`);
      continue;
    }
    let category = categories.get(categoryName.toLowerCase());
    if (!category) {
      category = await prisma.category.create({ data: { name: categoryName, sortOrder: ++maxSort } });
      categories.set(categoryName.toLowerCase(), category);
    }
    const existing = await prisma.product.findUnique({
      where: { categoryId_name: { categoryId: category.id, name } },
    });
    const roundedPrice = Math.round(price * 100) / 100;
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: { price: roundedPrice, vatRate } });
      updated++;
    } else {
      await prisma.product.create({ data: { name, categoryId: category.id, price: roundedPrice, vatRate } });
      created++;
    }
  }
  return NextResponse.json({ created, updated, errors });
});
