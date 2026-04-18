

## Plan: Two Targeted Fixes

### Fix 1 — `src/lib/utils.ts` `fmtAmount`

Current implementation already uses `minimumFractionDigits: 0, maximumFractionDigits: 0` (rounds via `toLocaleString`), but spec requires explicit `Math.round()` and the simpler form. Replace with:

```ts
export function fmtAmount(n: number): string {
  const abs = Math.abs(Math.round(n));
  const formatted = `₨ ${abs.toLocaleString()}`;
  return n < 0 ? `(${formatted})` : formatted;
}
```

Keeps `₨` prefix and negative parenthesization. `fmtQty` untouched.

### Fix 2 — `src/components/reports/DailyTransactionsReport.tsx` `cashSummary`

Inside the `cashSummary` queryFn, after the existing `priorExpenseTotal` block and before `const opening = Math.round(...)`:

1. Fetch all invoices with `invoice_date < dateStr` and `amount_paid > 0`
2. Fetch all linked payments for those invoice IDs
3. Compute `untrackedCashIn` (sales) and `untrackedCashOut` (purchases) = `amount_paid - sum(linked payments)` when positive
4. Update `opening` formula to: `openingFromContacts + priorReceipts + untrackedCashIn − priorPaymentsOut − untrackedCashOut − priorExpenseTotal`

Mirrors `calculateCashInHand` in `src/lib/financial-utils.ts`. No other changes — today's flow, UI, table, and totals stay identical.

### Files changed
1. `src/lib/utils.ts` — `fmtAmount` only
2. `src/components/reports/DailyTransactionsReport.tsx` — `cashSummary` opening calc only

