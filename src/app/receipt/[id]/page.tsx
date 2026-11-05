import { Receipt } from "./receipt";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ received?: string; change?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const received = Number(sp.received ?? 0);
  const change = Number(sp.change ?? 0);
  return (
    <Receipt
      id={id}
      restaurantName={process.env.RESTAURANT_NAME || "CompuCash Lite Restoran"}
      cashReceived={Number.isFinite(received) ? received : 0}
      change={Number.isFinite(change) ? change : 0}
    />
  );
}
