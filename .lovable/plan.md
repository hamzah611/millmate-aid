

## Three Fixes for A.G Aata Chaki

### PRIORITY 1 — Fix: "Closing" category contacts excluded from invoices

**Root cause**: In `src/components/InvoiceForm.tsx` line 70, the contact query filters out all contacts where `account_category` is `"cash"`, `"bank"`, or `"closing"`. The 30 customers with category `"closing"` (Customers Accounts Will Be Closed) are being excluded.

**Fix**: Remove `"closing"` from the exclusion list on line 70. Change:
```typescript
return (data || []).filter(c => !["cash", "bank", "closing"].includes(c.account_category || ""));
```
to:
```typescript
return (data || []).filter(c => !["cash", "bank"].includes(c.account_category || ""));
```

**File**: `src/components/InvoiceForm.tsx` — 1 line change.

---

### PRIORITY 2 — New: Daily Transactions Report

**New file**: `src/components/reports/DailyTransactionsReport.tsx`

- Single date picker (defaults to today)
- Fetches all transactions for that date: invoices (sales/purchases), payments (receipts/payments), and expenses
- Columns: Date | Contact/Account | Account Category | Type (Sale/Purchase/Receipt/Payment/Expense) | Debit | Credit | Running Balance
- Grouped by account category with subtotals per group
- Daily grand total at bottom
- Print button (window.print) and CSV export button
- Uses existing `DateRangePicker` pattern for date selection (single day: from=to)
- Uses existing table components and styling

**Updated file**: `src/pages/Reports.tsx` — add tab "daily-transactions" with label "Daily Transactions"

---

### PRIORITY 3 — New: Daily Products Report

**New file**: `src/components/reports/DailyProductsReport.tsx`

- Single date picker (defaults to today)
- Two sections: **Sales** and **Purchases**, plus an **Expenses** section
- Fetches invoice_items joined with invoices for the selected date, grouped by invoice_type
- Sales products: Wheat Atta, Rice Atta, Powder, Chill, Choona
- Purchase products: Wheat, Rice / Rice Broken, Rice Arri 6, Sarsoon / Mustered Oil
- Columns: Product Name | Quantity | Rate | Total Amount
- Section subtotals for Sales, Purchases, and Expenses
- Expenses section: fetches from expenses table for the date, showing category, amount
- Print and CSV export buttons

**Updated file**: `src/pages/Reports.tsx` — add tab "daily-products" with label "Daily Products"

---

### Files changed
1. `src/components/InvoiceForm.tsx` — remove "closing" from exclusion filter (1 line)
2. `src/components/reports/DailyTransactionsReport.tsx` — new file
3. `src/components/reports/DailyProductsReport.tsx` — new file
4. `src/pages/Reports.tsx` — add 2 new tabs + imports

### No database changes needed.

