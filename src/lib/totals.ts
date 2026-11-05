import { fromCents, toCents, vatFromGrossCents } from "./money";

export interface VatLine {
  vatRate: number;
  net: number;
  vat: number;
  gross: number;
}

export interface Totals {
  total: number;
  net: number;
  vat: number;
  byRate: VatLine[];
}

/** Calculates order totals and VAT breakdown from VAT-inclusive line prices. */
export function calcTotals(items: { unitPrice: number; quantity: number; vatRate: number }[]): Totals {
  const grossByRate = new Map<number, number>();
  for (const i of items) {
    grossByRate.set(i.vatRate, (grossByRate.get(i.vatRate) ?? 0) + toCents(i.unitPrice) * i.quantity);
  }
  let total = 0;
  let vat = 0;
  const byRate: VatLine[] = [...grossByRate.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([vatRate, gross]) => {
      const v = vatFromGrossCents(gross, vatRate);
      total += gross;
      vat += v;
      return { vatRate, gross: fromCents(gross), vat: fromCents(v), net: fromCents(gross - v) };
    });
  return { total: fromCents(total), vat: fromCents(vat), net: fromCents(total - vat), byRate };
}
