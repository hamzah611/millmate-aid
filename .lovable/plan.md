

## Fix Outstanding Balance + autoTable Runtime Error

### Two issues to fix

**Issue 1 — Outstanding balance out of sync (user request)**

Current code (lines 286-288) calculates `totalOutstanding` with a separate formula. Replace with:

```ts
const totalOutstanding = entriesWithBalance.length > 0
  ? entriesWithBalance[entriesWithBalance.length - 1].balance
  : openingBalance;
```

This must be placed **after** `entriesWithBalance` is computed (after line 382), not at its current location (line 286).

Update the summary card display (line 516) to show DR/CR formatting:
```ts
value: `${fmtAmount(Math.abs(totalOutstanding))} ${totalOutstanding >= 0 ? "DR" : "CR"}`
```

Also update the PDF summary box (line 403) to use the same DR/CR format.

**Issue 2 — `doc.autoTable is not a function` (runtime error)**

The `jspdf-autotable` side-effect import exists but isn't being picked up at runtime. Fix by using `(doc as any).autoTable(...)` consistently. Looking at line 400, it already uses `(doc as any).autoTable` — the error stack points to line 762 which doesn't exist (671 lines). This may be a stale error or from ProductHistory.tsx. Will check ProductHistory.tsx and ensure all `autoTable` calls use the `(doc as any)` cast.

### Changes

| File | What |
|---|---|
| `src/pages/ContactLedger.tsx` | Move `totalOutstanding` after `entriesWithBalance`, derive from final balance; format as DR/CR in summary card and PDF |
| `src/pages/ProductHistory.tsx` | Fix any `doc.autoTable` calls to use `(doc as any).autoTable` if needed |

