

## Final Polish & Verification Pass

### Overview
Targeted improvements across 4 areas: CSV export completeness, mobile table overflow, demo data seeding, and minor UI polish. Core logic (stock, payments, reports, invoicing) has been verified correct through previous QA passes.

### 1. CSV Export Verification & Fixes

**Currently working:** Contacts, Products, Sales, Purchases, Expenses, Adjustments — all have `exportToCSV` calls with proper headers.

**Missing:** Production page and Reports page have no CSV export.

**Fix:**
- `src/pages/Production.tsx` — Add CSV export button with columns: Date, Source Product, Source Qty, Outputs
- Reports: Financial reports (P&L, Cash Flow, Balance Sheet) don't have export. Add a simple CSV export button to each report section in `src/components/reports/FinancialReports.tsx`

**Date formatting fix in CSV:** Sales and Purchases export raw `inv.invoice_date` (ISO format). Format dates before export using `toLocaleDateString()` for readability.

### 2. Mobile Optimization

**Issue:** Tables overflow on mobile without horizontal scroll. The `.table-card` class has `overflow-hidden` which clips content.

**Fixes:**
- `src/index.css` — Change `.table-card` from `overflow-hidden` to `overflow-x-auto` to enable horizontal scrolling on mobile
- `src/pages/Expenses.tsx` — Filters row wraps fine (`flex-wrap`), no change needed
- `src/pages/Sales.tsx` / `src/pages/Purchases.tsx` — Page header uses `page-header` (flex row). On mobile, buttons may overflow. Add `flex-wrap gap-3` to the page-header sections
- `src/index.css` — Update `.page-header` to include `flex-wrap gap-3`
- Dashboard summary cards: Already use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` — stacks properly on mobile

### 3. Demo Data Seeding (Database Migration)

Add realistic demo data via SQL migration. **Do NOT delete existing data.** Use INSERT with specific UUIDs (prefix `d000` for demo).

**Contacts (6 new):**
- 3 customers: Ahmed Rice Traders, Bilal Flour Mills, Karachi Wholesale
- 3 suppliers: Punjab Grain Corp, Sindh Commodities, Lahore Spice House

**Products (4 new):** Basmati Rice, Chana Dal, Sugar, Turmeric Powder — with realistic stock levels, prices, units

**Invoices (6 new):**
- 3 sales: 1 paid, 1 partial, 1 credit
- 3 purchases: 2 paid, 1 credit
- With corresponding `invoice_items`

**Production (1 new):** Rice processing — source: Basmati Rice → output: Broken Rice

**Adjustments (2 new):** 1 increase (physical count), 1 decrease (damage)

**Expenses (5 new):** Rent, Labor, Transport, Utilities, Maintenance — spread across current month with mix of cash/bank

### 4. Minor UI Polish

- Production page: Add page icon and subtitle consistent with other pages (currently plain `<h1>`)
- Production date column: Format with `toLocaleDateString()` instead of raw ISO
- Reports tabs: Already have `flex-wrap` — works on mobile
- Inventory page: Has `p-4 md:p-6` padding — inconsistent with AppLayout which already provides `p-4 md:p-6`. Remove duplicate padding from `src/pages/Inventory.tsx` and `src/pages/Adjustments.tsx`

### 5. Double-Click Prevention

All save buttons already have `disabled={saving}` — verified across InvoiceForm, RecordPayment, ProductionNew. No fix needed.

### Files Changed
| File | Change |
|------|--------|
| `src/index.css` | `.table-card` overflow-x-auto; `.page-header` flex-wrap gap |
| `src/pages/Production.tsx` | Add CSV export, page icon, format dates |
| `src/pages/Sales.tsx` | Format date in CSV export |
| `src/pages/Purchases.tsx` | Format date in CSV export |
| `src/pages/Inventory.tsx` | Remove duplicate padding |
| `src/pages/Adjustments.tsx` | Remove duplicate padding |
| `src/components/reports/FinancialReports.tsx` | Add CSV export to P&L, Cash Flow, Balance Sheet |
| `supabase/migrations/...` | Demo data: contacts, products, invoices, items, production, adjustments, expenses |
| `src/contexts/LanguageContext.tsx` | Translation keys for new export labels |

