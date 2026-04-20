

## Plan: Single Sale/Purchase/Both filter for Top Products, remove duplication with the Sales vs Purchases tab

### What's happening today
- The Reports page has a top-level tab called **"Sales vs Purchases"** (a separate report).
- Inside the **Top Products** report there is a Sale/Purchase toggle — but it has only two options (no "Both"), so the user has two places that look like they answer the same question.

### Goal
One control inside **Top Products** that switches between **Sale**, **Purchase**, and **Both** — and stop the top-level "Sales vs Purchases" tab from looking like a competing selector for Top Products.

### Changes

**1. `src/components/reports/TopProductsChart.tsx`**
- Change filter state type to `"sale" | "purchase" | "both"`, default `"both"`.
- Add a third toggle item: `<ToggleGroupItem value="both">Both</ToggleGroupItem>`.
- Both Supabase queries (current + previous period): when `filter === "both"`, drop the `.eq("invoices.invoice_type", ...)` clause; otherwise filter as today. Keep `filter` in both `queryKey`s so refetches still work.
- Card title:
  - `sale` → `t("dashboard.topProducts")` ("Top Selling Products")
  - `purchase` → `t("dashboard.topPurchased")` ("Top Purchased Products")
  - `both` → new key `dashboard.topProductsAll` ("Top Products — Sales & Purchases")
- CSV filename stays `top-products-${filter}` (now includes `both`).

**2. `src/contexts/LanguageContext.tsx`**
- Add `dashboard.topProductsAll` (en: "Top Products — Sales & Purchases", ur: "ٹاپ پروڈکٹس — فروخت اور خریداری").
- Add `common.both` if missing — used as the toggle label in EN/UR. (`contacts.both` already exists with "Both/دونوں" — we'll reuse that to avoid a new key.)

**3. `src/pages/Reports.tsx`** — remove the redundancy
- Remove the standalone **"Sales vs Purchases"** tab (`{ value: "sales-purchases", ... }`) and its `<TabsContent value="sales-purchases">` block, plus the now-unused `SalesPurchasesChart` import.
- Reasoning: Top Products in "Both" mode plus the existing Profit Margins / Daily Transactions reports already cover this. This eliminates the perceived duplicate selector at the top of the page. The `SalesPurchasesChart.tsx` file itself is left untouched (no other consumer), so it's harmless dead code we can clean up later if you want.

### Out of scope
- No changes to other reports, queries, schema, or shared utils.
- No DB changes.

### Files changed
1. `src/components/reports/TopProductsChart.tsx`
2. `src/contexts/LanguageContext.tsx`
3. `src/pages/Reports.tsx`

