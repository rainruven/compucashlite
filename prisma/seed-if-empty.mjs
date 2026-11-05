// Seeds the database only when it is empty: creates 10 dining tables and
// imports the menu from prisma/menu.csv. Runs automatically on every start
// (see "start" in package.json) and does nothing if data already exists.
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f !== ""));
}

async function main() {
  const tableCount = await prisma.diningTable.count();
  if (tableCount === 0) {
    await prisma.diningTable.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({ name: `Laud ${i + 1}`, seats: 4, sortOrder: i + 1 })),
    });
    console.log("[seed] Created 10 tables");
  }

  const productCount = await prisma.product.count();
  const categoryCount = await prisma.category.count();
  if (productCount > 0 || categoryCount > 0) {
    console.log("[seed] Menu already present, skipping");
    return;
  }

  const file = ["menu.csv", "menu_1.csv"].map((f) => join(here, f)).find((p) => existsSync(p));
  if (!file) {
    console.log("[seed] No menu CSV found, skipping menu import");
    return;
  }
  const rows = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
  const header = rows.shift()?.map((h) => h.toLowerCase()) ?? [];
  const idx = (n) => header.indexOf(n);
  const [ci, ni, pi, vi] = [idx("category"), idx("name"), idx("price"), idx("vat_rate")];

  const categoryIds = new Map();
  let created = 0;
  for (const r of rows) {
    const categoryName = r[ci];
    const name = r[ni];
    const price = Number(String(r[pi]).replace(",", "."));
    const vatRate = vi >= 0 && r[vi] ? Number(String(r[vi]).replace(",", ".")) : 24;
    if (!categoryName || !name || !Number.isFinite(price) || price < 0) continue;
    let categoryId = categoryIds.get(categoryName);
    if (!categoryId) {
      const cat = await prisma.category.create({ data: { name: categoryName, sortOrder: categoryIds.size + 1 } });
      categoryId = cat.id;
      categoryIds.set(categoryName, categoryId);
    }
    await prisma.product.upsert({
      where: { categoryId_name: { categoryId, name } },
      update: { price, vatRate },
      create: { name, categoryId, price, vatRate },
    });
    created++;
  }
  console.log(`[seed] Imported ${created} products in ${categoryIds.size} categories from ${file}`);
}

main()
  .catch((e) => {
    console.error("[seed] Failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
