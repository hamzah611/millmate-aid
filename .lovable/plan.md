

## Fix 5 Issues: Contact Ledger, Balance Sheet BU Filter, Expense Product Linking

### ISSUE 1 — Fix `totalOutstanding` calculation and `invoicePayments` query

**File: `src/pages/ContactLedger.tsx`**

- Replace the `invoicePayments` query: instead of using `invoices!inner(contact_id)` join (unreliable in Supabase JS), do a two-step fetch — first get invoice IDs for this contact from the already-fetched `invoices` data, then fetch payments where `invoice_id` is in that list.
- Fix `totalOutstanding`: instead of blindly subtracting `directVoucherTotal`, split by voucher_type — receipt vouchers reduce outstanding, payment vouchers increase it.

```
// Before:
const totalOutstanding = invoiceBalanceDue + Math.max(openingBalance, 0) - directVoucherTotal;

// After:
const directReceipts = directVouchers.filter(v => v.voucher_type === "receipt").sum(amount);
const directPayments = directVouchers.filter(v => v.voucher_type === "payment").sum(amount);
const totalOutstanding = invoiceBalanceDue + Math.max(openingBalance, 0) - directReceipts + directPayments;
```

### ISSUE 2 — Unified ledger table (Date | Reference | Description | Debit | Credit | Balance)

**File: `src/pages/ContactLedger.tsx`**

- Remove the two separate tables (Invoice History + Payment & Voucher History).
- Replace with a single unified ledger table.
- Determine contact type from `contact.account_category` (customer vs supplier).
- Build unified entries from invoices + all payments, sorted by date ascending.
- Opening balance as first row; running balance column computed cumulatively.
- For customers: sale invoices → Debit, receipts → Credit. For suppliers: purchase invoices → Debit, payments → Credit.
- Keep the InvoiceDetailDialog and VoucherDetailDialog — clicking a row opens the appropriate detail.
- Keep summary cards at the top unchanged.

### ISSUE 3 — Enhanced statement CSV export

**File: `src/pages/ContactLedger.tsx`**

- Fetch invoice items (with product names) for all contact invoices.
- Export CSV with: header rows (contact name), then unified ledger rows (Date, Reference, Description, Debit, Credit, Running Balance), with product names listed in the Description for invoice rows.
- Final row: closing balance.

### ISSUE 4 — Business Unit filter in Balance Sheet Professional

**File: `src/components/reports/BalanceSheetProfessional.tsx`**

The BU filter is already applied to customer and supplier invoice queries (lines 165, 267). The issue states it's only on customer queries — but looking at the code, both are filtered. However, the direct voucher calculations in both customer and supplier sections don't account for BU — they include ALL direct vouchers regardless of BU.

Since payments don't have a `business_unit` field, we can't directly filter them. The BU filter should only affect invoice-driven data (receivables/payables from invoices). Direct vouchers are contact-level and don't belong to a BU, so they should remain as-is — this is actually correct behavior for the current data model. No changes needed here beyond what's already implemented.

The Balance Sheet summary view in `FinancialReports.tsx` already passes `businessUnit` to `calculateReceivables` and `calculatePayables`. These functions already filter invoices by BU.

**Conclusion**: The BU filter is already working correctly for the data that can be filtered. No code changes needed for Issue 4.

### ISSUE 5 — Add product linking to expenses

**Database migration**: Add nullable `product_id uuid` column to the `expenses` table.

**File: `src/pages/ExpenseNew.tsx`**
- Add a Product dropdown (optional) using `SearchableCombobox`, fetching from `products` table.
- Store selected `product_id` in the insert.

**File: `src/pages/ExpenseEdit.tsx`**
- Same product dropdown, pre-populated from existing expense data.

**File: `src/pages/Expenses.tsx`**
- Fetch products joined or separately to show product name column.
- Add "Product" column to the table.

### Summary of file changes

| File | Changes |
|---|---|
| `src/pages/ContactLedger.tsx` | Fix outstanding calc, fix invoicePayments query, unified ledger table, enhanced CSV export with product details |
| `src/components/reports/BalanceSheetProfessional.tsx` | No changes needed (already correct) |
| `src/pages/ExpenseNew.tsx` | Add optional Product dropdown |
| `src/pages/ExpenseEdit.tsx` | Add optional Product dropdown |
| `src/pages/Expenses.tsx` | Add Product column, fetch product data |
| DB migration | Add `product_id` column to `expenses` table |

