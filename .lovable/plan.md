

## Professional Detailed Balance Sheet View

### Overview
Add a "Professional View" toggle button to the existing Balance Sheet. When active, it renders a comprehensive, fully-detailed view showing every individual transaction, contact, and account — all within expandable/collapsible sections. The existing summarized view remains the default and is untouched.

### Approach
Create a new component `BalanceSheetProfessional` in a separate file to keep `FinancialReports.tsx` manageable. The existing `BalanceSheetReport` gets a toggle button that conditionally renders the professional component.

### Changes

**1. New file: `src/components/reports/BalanceSheetProfessional.tsx`**

A full-detail Balance Sheet component with:
- Same two-column Debit/Credit layout and shared helper components (`bsFmt`, `BSSectionHeader`, `BSTotalRow`, `BSCollapsibleItem`, `BSSubLine`)
- Reuses the same data-fetching functions from `financial-utils.ts`
- **Cash in Hand**: auto-expanded with full breakdown (opening, each receipt voucher, each payment voucher, expenses)
- **Bank Accounts**: each bank auto-listed with individual transaction details (lazy-loaded: all bank vouchers grouped by bank)
- **Customer Receivables**: every customer with non-zero balance listed, each expandable to show opening balance + individual unpaid invoices
- **Supplier Payables**: same pattern as customers
- **Employee Receivables**: all employees listed
- **Inventory**: all products listed with stock qty, unit, avg cost, valuation, cost source badge
- **Capital/Equity**: all closing accounts listed, retained earnings with full calculation
- All sections use `BSCollapsibleItem` with lazy-loading via `useQuery({ enabled })` pattern
- Totals row at bottom of each column, balance confirmation footer

**2. Modified file: `src/components/reports/FinancialReports.tsx`**

- Extract shared helper components (`bsFmt`, `BSSectionHeader`, `BSTotalRow`, `BSCollapsibleItem`, `BSSubLine`, `BSLineItem`) to be exported so the professional view can import them
- Add `const [professionalView, setProfessionalView] = useState(false)` in `BalanceSheetReport`
- Add a toggle button next to the Export CSV button: "Professional View" / "Summary View"
- When `professionalView` is true, render `<BalanceSheetProfessional range={range} />` instead of the existing content (below the header/toggle)

**3. Modified file: `src/contexts/LanguageContext.tsx`**

- Add translation keys: `reports.professionalView`, `reports.summaryView`

### Technical Details
- Professional view lazy-loads detailed transaction lists (individual vouchers per bank, individual invoices per customer/supplier) only when their section is expanded
- No changes to any financial calculation functions
- No database migrations needed
- Shared components are exported from FinancialReports.tsx to avoid duplication

