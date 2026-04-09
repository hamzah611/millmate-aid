

## Add Untracked Cash Safety Net to Cash in Hand

### Finding
Database query confirms zero untracked invoices currently exist — the auto-payment generation on invoice save works correctly. This change adds a defensive safety net for any edge cases.

### File 1: `src/lib/financial-utils.ts`

**Update `CashInHandResult` interface** (lines 30-37) — add two fields:
```typescript
untrackedCashIn: number;
untrackedCashOut: number;
```

**Update `calculateCashInHand()`** (lines 39-57) — after cashExpenses calculation, add:
- Fetch all invoices with `amount_paid > 0`
- Fetch all payments with non-null `invoice_id`
- Build a map of total linked payments per invoice
- Calculate untracked amounts per invoice (amount_paid - linked total)
- Split into `untrackedCashIn` (sales) and `untrackedCashOut` (purchases)
- Update total: `opening + cashReceipts + untrackedCashIn - cashPayments - untrackedCashOut - cashExpenses`
- Return the two new fields

### File 2: `src/components/reports/BalanceSheetProfessional.tsx`

**Update Cash in Hand detail section** (lines 388-393) — add two `DetailLine` entries after existing ones:
- `"Direct Cash Sales (Untracked)"` showing `untrackedCashIn` (positive)
- `"Direct Cash Purchases (Untracked)"` showing `untrackedCashOut` (negative)
- Only render each line if value > 0

### File 3: `src/components/dashboard/DashboardBreakdown.tsx`

**Update Cash breakdown** (lines 179-191) — add two `LineItem` entries:
- Under "Cash In": `"Direct Cash Sales (Untracked)"` with sign "+"
- Under "Cash Out": `"Direct Cash Purchases (Untracked)"` with sign "-"
- Only render each if value > 0

### No database changes.

