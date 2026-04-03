

## Fix Currency Formatting: Remove Decimals from Rupee Amounts

### Change
Update `fmtAmount()` in `src/lib/utils.ts` to show **zero decimal places** for currency. `fmtQty()` stays at 3 decimals for quantities.

### Single File Change

**`src/lib/utils.ts`** — Change `fmtAmount`:
```typescript
export function fmtAmount(n: number): string {
  const abs = Math.abs(n);
  const formatted = `₨ ${abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return n < 0 ? `(${formatted})` : formatted;
}
```

Result: `₨ 27,086` instead of `₨ 27,086.000`

Since all currency display across the app already uses `fmtAmount()`, this single change propagates everywhere — dashboard boxes, balance sheet, invoices, products, vouchers, reports, ledgers. No other files need modification.

`fmtQty()` remains unchanged at 3 decimal places for stock quantities.

