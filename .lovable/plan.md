

## Plan: Round Sale/Purchase Amounts + Add Cash Balance to Daily Transactions Report

Scope reduced after clarification: only **Bug 1** (rounding) and **Bug 4** (daily cash opening/closing balance). Bugs 2/3 confirmed as already correct via existing auto-payment flow. Bug 5 skipped.

---

### Bug 1 — Round all sale/purchase amounts to whole rupees

**Why:** `fmtAmount()` already drops decimals on display, but raw values stored in the DB and used in arithmetic carry decimals (`qty × price`, broker commission). This causes tiny mismatches between line totals, subtotals, and reported sums.

**Fix — apply `Math.round()` at compute time on rupee values only (never on quantities):**

`src/components/InvoiceItemRow.tsx`
- Round `total = qty * price_per_unit` in every handler (lines 108, 129, 137, 142, 147)
- Round `newPrice` in `handleUnitChange` to whole rupees (line 120)

`src/components/InvoiceForm.tsx`
- Round `subtotal`, `total`, `balanceDue`, `amountPaid` (lines 168–170)
- Round `brokerCommissionTotal` to whole rupees (line 185)
- Round `amountPaid` setter when paymentStatus changes (line 190)

No DB schema change. No display layer change (already shows whole numbers).

---

### Bug 4 — Daily Transactions Report: show Cash in Hand opening + closing

**Fix — `src/components/reports/DailyTransactionsReport.tsx`:**

Add a second query that computes the Cash in Hand balance **as of the day before `dateStr`**:
- Sum of all cash opening balances from `contacts` where `account_category = 'cash'`
- + cash receipts (payments where `payment_method='cash'` AND `voucher_type='receipt'`) with `payment_date < dateStr`
- − cash payments (payments where `payment_method='cash'` AND `voucher_type='payment'`) with `payment_date < dateStr`
- − cash expenses (expenses where `payment_method='cash'`) with `expense_date < dateStr`

Then for **today** compute:
- Cash Received Today = today's cash receipts
- Cash Paid Today = today's cash payments + today's cash expenses
- Closing Balance = Opening + Received − Paid

Render a compact summary card **above the existing transaction table**:

```text
┌──────────────────────────────────────────────────┐
│  Cash in Hand                                    │
│  Opening Balance (15 Apr)        ₨ 1,25,000      │
│  + Cash Received Today           ₨   45,000      │
│  − Cash Paid Today               ₨   18,000      │
│  ─────────────────────────────────────────────   │
│  Closing Balance (16 Apr)        ₨ 1,52,000      │
└──────────────────────────────────────────────────┘
```

Existing transaction table below stays unchanged.

---

### Files changed

1. `src/components/InvoiceItemRow.tsx` — round line totals
2. `src/components/InvoiceForm.tsx` — round subtotal/total/balance/commission
3. `src/components/reports/DailyTransactionsReport.tsx` — add cash opening/closing card

No schema changes. No changes to ledger logic, balance sheet, or any working code.

