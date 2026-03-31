

## Fix: Date Filtering Not Affecting Report Data

### Root Cause

Your database currently has **zero invoices, zero expenses, zero payments** — the only data is **140 contacts with opening balances**. The opening balances were intentionally coded to bypass date filtering (as carry-forward items), which means no matter what date range you pick, you see the exact same data every time.

### Solution

Apply date range filtering to opening balances across all reports that use them, and ensure consistent behavior:

### Changes

**1. Balance Sheet** (`FinancialReports.tsx`)
- Currently queries contacts where `opening_balance_date <= toDate` (no `fromDate` filter)
- Fix: Also filter `opening_balance_date >= fromDate` so the date range actually affects what shows

**2. Aging Report** (`AgingReport.tsx`)
- Currently opening balances are **always** fetched regardless of date range
- Fix: Filter opening balances by `opening_balance_date >= fromDate` and `opening_balance_date <= toDate`
- This means selecting "This Month" (March 2026) will correctly exclude December 2025 opening balances, and selecting a range that includes December 2025 will show them

**3. All other reports** (Sales vs Purchases, Top Products, Profit Margins, P&L, Cash Flow, Cash Closing)
- These query `invoices`, `expenses`, `payments` tables which are currently empty
- Date filters are already correctly applied — they will work properly once you start adding invoices

### Summary

| Report | Current Behavior | Fixed Behavior |
|--------|-----------------|----------------|
| Balance Sheet | Opening balances always show | Filtered by selected date range |
| Aging Report | Opening balances always show | Filtered by selected date range |
| Other 6 reports | Already filtered correctly | No change needed |

### Files Changed

| File | Change |
|------|--------|
| `src/components/reports/FinancialReports.tsx` | Add `fromDate` filter to opening balances query in Balance Sheet |
| `src/components/reports/AgingReport.tsx` | Add date range filters to opening balances query |

