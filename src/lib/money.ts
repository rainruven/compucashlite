// Money helpers. All arithmetic is done in integer cents to avoid float errors.

export function toCents(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? 0).replace(",", "."));
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

const eurFormat = new Intl.NumberFormat("et-EE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats a euro amount in Estonian format, e.g. "12,50 €". */
export function formatEur(amount: number): string {
  return eurFormat.format(amount).replace(/[  ]/g, " ");
}

/** VAT part (in cents) contained in a VAT-inclusive gross amount (in cents). */
export function vatFromGrossCents(grossCents: number, vatRate: number): number {
  return Math.round((grossCents * vatRate) / (100 + vatRate));
}

export function formatVatRate(rate: number): string {
  return `${String(rate).replace(".", ",")}%`;
}

/** Parses user input like "12,50" or "12.50" into a number (NaN if invalid). */
export function parseAmount(input: string): number {
  const s = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d*(\.\d*)?$/.test(s) || s === "" || s === ".") return NaN;
  return Number(s);
}
