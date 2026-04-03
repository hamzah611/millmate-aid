

## Rebuild Balance Sheet — Shared Logic, Drill-Downs, Exact Reconciliation

### Core Principle
Extract shared financial calculation functions into `financial-utils.ts` so both the Dashboard and Balance Sheet call the **same code**. No duplicated queries.

---

### Step 1: Extract shared helpers into `src/lib/financial-utils.ts`

Add these new exported functions (reusing existing patterns from `Index.tsx` and `DashboardBreakdown.tsx`):

**A. `calculateCashInHand(): Promise<CashInHandResult>`**
- Moves the exact logic from `Index.tsx` lines 59-91 into a reusable function
- Returns `{ total, opening, cashReceipts, cashPayments, untrackedSaleCash, untrackedPurchaseCash, cashExpenses }` so drill-downs can show breakdown components

**B. `calculateBankBalances(): Promise<BankBalance[]>`**
- Moves the exact logic from `Index.tsx` lines 115-145 into a reusable function
- Returns `{ id, name, balance, opening, receipts, payments, expenses }[]` — detailed enough for drill-downs

**C. `calculateReceivables(): Promise<{ total, openingBalance, invoiceBalance }>`**
- Moves logic from `Index.tsx` lines 94-101

**D. `calculatePayables(): Promise<{ total, openingBalance, invoiceBalance }>`**
- Moves logic from `Index.tsx` lines 104-111

Each function returns both the **total** and the **components** that sum to it, ensuring drill-down reconciliation.

### Step 2: Update `src/pages/Index.tsx` (Dashboard)

Replace inline query functions with calls to the new shared helpers:
- `totalCash` query → `calculateCashInHand()`
- `bankBalances` query → `calculateBankBalances()`
- `receivables` query → `calculateReceivables()`
- `payables` query → `calculatePayables()`

No change to displayed values — same results, just calling shared code.

### Step 3: Update `src/components/dashboard/DashboardBreakdown.tsx`

Replace inline queries in `CashBreakdown`, `BankBreakdown`, `ReceivablesBreakdown`, `PayablesBreakdown` with calls to the same shared helpers. The drill-down components use the detailed breakdown fields returned by each helper.

### Step 4: Rebuild `BalanceSheetReport` in `src/components/reports/FinancialReports.tsx`

**A. Use shared helpers for all values:**
- Cash in Hand → `calculateCashInHand()` (currently uses only `bal.cashBalance` — opening only, which is WRONG)
- Bank Accounts → `calculateBankBalances()` (currently uses only `bal.bankBalance` — opening only, which is WRONG)
- Receivables → `calculateReceivables()`
- Payables → `calculatePayables()`
- Inventory → `calculateInventoryValue()` (already shared)
- Employee Receivables → `fetchCategoryBalances().employeeReceivables`
- Capital → `fetchCategoryBalances().capitalEquity`

**B. Add collapsible drill-down sections (using Radix Collapsible, already installed):**

Each major line item gets a clickable chevron that expands to show breakdown:

- **Cash in Hand** → opening, +receipts, +untrackedSale, -payments, -untrackedPurchase, -expenses = total
- **Bank Accounts** → each bank listed with opening, +receipts, -payments, -expenses = balance
- **Customer Receivables** → opening balance portion + invoice balance portion (lazy-load customer list on expand)
- **Supplier Payables** → same pattern
- **Inventory** → product-wise breakdown (lazy-load on expand, reuse `inventoryData.products`)

All drill-down sub-items will sum exactly to the parent total — enforced by using the same data source.

**C. Currency formatting:**
- Use `₨ ${value.toLocaleString()}` with space consistently
- Negative values: `(₨ 1,234)` format

**D. Always show Employee Receivables** (even when 0, display ₨ 0)

**E. Retained Earnings** = `totalAssets - totalLiabilities - capitalEquity` (unchanged formula)

### Step 5: Add translation keys in `src/contexts/LanguageContext.tsx`

New keys for drill-down labels: `reports.openingBalance`, `reports.voucherReceipts`, `reports.voucherPayments`, `reports.untrackedCash`, `reports.cashExpenses`

---

### What Will NOT Change
- No new financial formulas or accounting logic
- `fetchCategoryBalances()` and `calculateInventoryValue()` unchanged
- Invoice logic, voucher logic, opening balances unchanged
- Retained Earnings formula unchanged

### Reconciliation Guarantee
Every drill-down section uses the **same data object** as its parent total. The components returned by each shared helper are the exact addends/subtrahends that produce the total. No separate queries for drill-downs vs. totals.

