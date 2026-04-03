

## Dashboard Boxes: Enhanced Drill-Down with Transaction Details

### Current State
Dashboard boxes are already clickable and open a Drawer (`DashboardBreakdown.tsx`) showing summary calculations (Opening + Receipts - Payments = Total). Inventory opens a Dialog with per-product table. This works but only shows aggregated numbers — no individual transactions, contacts, or invoices.

### What Changes

#### 1. `src/components/dashboard/DashboardBreakdown.tsx` — Add transaction-level drill-downs

**Cash Breakdown** (enhanced):
- Keep existing summary (Opening, Receipts, Payments, Expenses = Total)
- Add collapsible "View Transactions" section below the summary
- Lazy-fetch on expand: all cash vouchers + cash expenses, sorted by date
- Show each row: date, contact name, voucher number, amount (+/-), running balance
- Scrollable list with max-height

**Bank Breakdown** (enhanced):
- Keep existing per-bank summary
- Add collapsible per-bank transaction list
- Lazy-fetch: vouchers where `bank_contact_id = bankId` + bank expenses for that bank
- Each row: date, contact, voucher number, amount, running balance

**Receivables Breakdown** (enhanced):
- Replace simple summary with a **top customers list**
- Fetch contacts with `account_category = 'customer'` that have opening_balance > 0 OR unpaid invoices
- Show each customer: name, opening balance, invoice balance, total owed
- Each customer row is collapsible → expands to show their unpaid invoices (invoice number, date, total, balance_due)
- Sort by total owed descending

**Payables Breakdown** (enhanced):
- Same pattern as Receivables but for suppliers
- Top suppliers by amount owed
- Collapsible per-supplier with unpaid purchase invoices

**Employee Breakdown** (no change needed — already shows per-employee)

#### 2. `src/components/dashboard/InventoryBreakdown.tsx` — Minor enhancement
- Already has per-product table; no major changes needed
- Optionally add collapsible per-product purchase history (lazy-loaded)

#### 3. `src/contexts/LanguageContext.tsx` — New translation keys
- `dashboard.viewTransactions` / "View Transactions" / "لین دین دیکھیں"
- `dashboard.runningBalance` / "Running Balance" / "چلتا بیلنس"
- `dashboard.topCustomers` / "Top Customers" / "اہم گاہک"
- `dashboard.topSuppliers` / "Top Suppliers" / "اہم فراہم کنندگان"
- `dashboard.outstandingInvoices` / "Outstanding Invoices" / "بقایا انوائسز"
- `dashboard.voucherNo` / "Voucher #" / "واؤچر نمبر"

#### 4. No changes to `financial-utils.ts` or `Index.tsx`
- All new data fetching happens inside the breakdown components via `useQuery`
- Dashboard totals remain identical
- Drill-down sums use the same shared helpers for the summary section

### Data Fetching Strategy
- Summary section: uses existing shared helpers (same as now)
- Transaction lists: fetched only when the user expands via Collapsible `onOpenChange`
- Uses `useQuery` with `enabled: false` + manual `refetch()` on first expand
- Receivables/Payables customer/supplier lists: single query joining contacts + invoices, paginated to top 20

### UI Pattern
```text
┌─────────────────────────────────┐
│ Cash in Hand                    │
│ ───────────────────────────     │
│ + Opening Balance    ₨ 50,000  │
│ + Cash Receipts      ₨ 200,000 │
│ - Cash Payments      ₨ 80,000  │
│ - Cash Expenses      ₨ 15,000  │
│ ═ Total              ₨ 155,000 │
│ ───────────────────────────     │
│ ▶ View Transactions (click)    │
│   ┌─ Date  Contact  Amt  Bal ─┐│
│   │ Apr 1  Ali     +5000 5000 ││
│   │ Apr 2  Exp     -1000 4000 ││
│   └───────────────────────────┘│
└─────────────────────────────────┘
```

For Receivables:
```text
┌─────────────────────────────────┐
│ Receivables                     │
│ Total: ₨ 350,000               │
│ ───────────────────────────     │
│ ▶ Ahmad Foods      ₨ 120,000   │
│   ├ INV SAL-012    ₨ 80,000    │
│   └ INV SAL-015    ₨ 40,000    │
│ ▶ Karachi Traders  ₨ 95,000    │
│ ▶ Lahore Mills     ₨ 75,000    │
│ ...                             │
└─────────────────────────────────┘
```

### Files Modified
1. `src/components/dashboard/DashboardBreakdown.tsx` — major enhancement
2. `src/contexts/LanguageContext.tsx` — new keys
3. No other files change

### What Will NOT Change
- `financial-utils.ts` — untouched
- `Index.tsx` — untouched (dashboard cards stay the same)
- Balance Sheet, invoice logic, voucher logic — untouched
- All totals remain identical

