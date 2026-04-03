

## Enhance Balance Sheet: Full Drill-Down, Formatting & Precision

### Summary
Make every Balance Sheet line item fully clickable/expandable with lazy-loaded transaction-level detail, improve currency formatting with proper spacing, always show Employee Receivables (even if zero), and display full decimal precision.

### Changes (single file: `src/components/reports/FinancialReports.tsx`)

**1. Currency formatting — add space after ₨**
- Replace `bsFmt` alias with a local `bsFmt` function that ensures `₨ ` (with space) formatting and preserves full decimals instead of rounding to zero decimals.
- Update `fmtAmount` usage within this file to use the new local formatter.

**2. Employee Receivables — make collapsible, always show**
- Convert from plain `BSLineItem` to `BSCollapsibleItem` so it's clickable.
- Add lazy-loaded query for employee contacts with non-zero opening balances.
- Always render even when value is 0.

**3. Customer Receivables — deeper drill-down**
- Add a lazy query for customers with outstanding invoice balances (not just opening balances).
- Show top customers by total outstanding (opening + invoice balance), with name and amount.
- Keep "Show more" pattern but fetch richer data: contact name + total owed.

**4. Supplier Payables — deeper drill-down**
- Same enhancement as customers: lazy query for suppliers with outstanding invoices.
- Show top suppliers by total owed.

**5. Inventory — full product list drill-down**
- Currently shows only top 10 products. Add a "Show all" toggle to lazy-load and display the complete list.
- Show quantity with full decimals using `fmtQty()`.

**6. Cash in Hand — already has good drill-down ✓**
- No structural change needed, just apply new formatting.

**7. Bank Accounts — already has per-bank drill-down ✓**
- No structural change needed, just apply new formatting.

**8. Closing Accounts (Capital) — make collapsible**
- Add lazy query for contacts with `account_category = 'closing'` to show individual capital accounts.

**9. Retained Earnings — make collapsible**
- Show the calculation breakdown: Total Assets − Total Liabilities − Capital = Retained Earnings.

**10. Precision — full decimals**
- Create a local `bsFmt` that uses `toLocaleString` without rounding (respects stored decimal precision).
- Apply to all `BSSubLine`, `BSLineItem`, `BSTotalRow`, and drill-down values.

### What does NOT change
- No financial calculation logic changes
- No new pages — all drill-down is in-place collapsible
- No changes to other report tabs
- Existing queries and data flow remain intact

### Technical approach
- All new queries use `enabled: boolean` flag for lazy loading (same pattern already used for `showCustomers`/`showSuppliers`)
- Import `fmtQty` for inventory quantity display
- ~150 lines of changes within the existing BalanceSheetReport component

