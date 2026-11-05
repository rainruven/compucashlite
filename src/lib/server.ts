import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { fromCents, toCents } from "./money";
import type {
  CategoryDto,
  KitchenStatus,
  OrderDto,
  OrderItemDto,
  OrderStatus,
  PaymentDto,
  PaymentMethod,
  ProductDto,
} from "./types";

/** Error with an HTTP status and a user-facing (Estonian) message. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const notFound = (msg = "Ei leitud") => new HttpError(404, msg);

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: maps validation and database errors to friendly JSON responses. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (
        e instanceof Prisma.PrismaClientInitializationError ||
        (e instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1008", "P1017"].includes(e.code))
      ) {
        console.error("Database unreachable:", e.message);
        return NextResponse.json(
          { error: "Andmebaasiga ei saa ühendust. Proovi mõne hetke pärast uuesti." },
          { status: 503 },
        );
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002") return NextResponse.json({ error: "Selline kirje on juba olemas." }, { status: 409 });
        if (e.code === "P2025") return NextResponse.json({ error: "Kirjet ei leitud." }, { status: 404 });
        if (e.code === "P2003")
          return NextResponse.json({ error: "Kirjet ei saa kustutada, sest seda kasutatakse." }, { status: 409 });
      }
      console.error(e);
      return NextResponse.json({ error: "Serveri viga. Proovi uuesti." }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw badRequest("Vigane päring.");
}

export function parseId(value: unknown, what = "ID"): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Vigane ${what}.`);
  return n;
}

export function requireString(value: unknown, field: string, max = 200): string {
  if (typeof value !== "string" || value.trim() === "") throw badRequest(`${field} on kohustuslik.`);
  const s = value.trim();
  if (s.length > max) throw badRequest(`${field} on liiga pikk.`);
  return s;
}

export function parseMoney(value: unknown, field: string): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (value === "" || value === null || value === undefined || !Number.isFinite(n))
    throw badRequest(`${field} peab olema number.`);
  if (n < 0) throw badRequest(`${field} ei tohi olla negatiivne.`);
  if (n > 1_000_000) throw badRequest(`${field} on liiga suur.`);
  return fromCents(toCents(n));
}

export function parseVatRate(value: unknown): number {
  if (value === undefined || value === null || value === "") return 24;
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) throw badRequest("Käibemaksumäär peab olema vahemikus 0–100.");
  return n;
}

const num = (d: Prisma.Decimal | number) => Number(d);
const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function serializeCategory(c: { id: number; name: string; sortOrder: number; active: boolean; _count?: { products: number } }): CategoryDto {
  return { id: c.id, name: c.name, sortOrder: c.sortOrder, active: c.active, productCount: c._count?.products };
}

export function serializeProduct(p: Prisma.ProductGetPayload<{ include: { category: true } }> | Prisma.ProductGetPayload<object>): ProductDto {
  return {
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    categoryName: "category" in p && p.category ? (p.category as { name: string }).name : undefined,
    price: num(p.price),
    vatRate: num(p.vatRate),
    active: p.active,
    createdAt: p.createdAt.toISOString(),
  };
}

export function serializeItem(i: Prisma.OrderItemGetPayload<object>): OrderItemDto {
  return {
    id: i.id,
    orderId: i.orderId,
    productId: i.productId,
    productName: i.productName,
    unitPrice: num(i.unitPrice),
    vatRate: num(i.vatRate),
    quantity: i.quantity,
    note: i.note,
    kitchenStatus: i.kitchenStatus as KitchenStatus,
    sentAt: iso(i.sentAt),
    createdAt: i.createdAt.toISOString(),
  };
}

export function serializePayment(p: Prisma.PaymentGetPayload<object>): PaymentDto {
  return {
    id: p.id,
    orderId: p.orderId,
    method: p.method as PaymentMethod,
    amount: num(p.amount),
    createdAt: p.createdAt.toISOString(),
  };
}

export const orderInclude = {
  table: true,
  items: { orderBy: { id: "asc" } },
  payments: { orderBy: { id: "asc" } },
} satisfies Prisma.OrderInclude;

export type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function serializeOrder(o: FullOrder): OrderDto {
  const paidCents = o.payments.reduce((s, p) => s + toCents(p.amount), 0);
  return {
    id: o.id,
    receiptNo: o.receiptNo,
    tableId: o.tableId,
    tableName: o.table.name,
    status: o.status as OrderStatus,
    total: num(o.total),
    paid: fromCents(paidCents),
    createdAt: o.createdAt.toISOString(),
    paidAt: iso(o.paidAt),
    items: o.items.map(serializeItem),
    payments: o.payments.map(serializePayment),
  };
}

export async function loadOrder(id: number, db: Prisma.TransactionClient = prisma): Promise<FullOrder> {
  const order = await db.order.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw notFound("Tellimust ei leitud.");
  return order;
}

/** Recalculates and stores the order total from its items. Returns total in cents. */
export async function recalcTotal(orderId: number, db: Prisma.TransactionClient): Promise<number> {
  const items = await db.orderItem.findMany({ where: { orderId } });
  const cents = items.reduce((s, i) => s + toCents(i.unitPrice) * i.quantity, 0);
  await db.order.update({ where: { id: orderId }, data: { total: fromCents(cents) } });
  return cents;
}

export async function requireOpenOrder(id: number, db: Prisma.TransactionClient = prisma) {
  const order = await db.order.findUnique({ where: { id } });
  if (!order) throw notFound("Tellimust ei leitud.");
  if (order.status !== "open") throw badRequest("Tellimus on juba suletud.");
  return order;
}
