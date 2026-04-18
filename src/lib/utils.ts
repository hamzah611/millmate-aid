import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as PKR currency with 3 decimal places and thousand separators.
 * e.g. 27086 → "₨ 27,086.000", -5000 → "(₨ 5,000.000)"
 */
export function fmtAmount(n: number): string {
  const abs = Math.abs(Math.round(n));
  const formatted = `₨ ${abs.toLocaleString()}`;
  return n < 0 ? `(${formatted})` : formatted;
}

/**
 * Format number with 3 decimals and thousand separators (no currency symbol).
 * e.g. 27.0864 → "27.086"
 */
export function fmtQty(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
