

## Plan: Add Sale/Purchase Filter to Top Products Chart

### Bug confirmed
`TopProductsChart.tsx` has no filter state and no toggle UI. Both queries hardcode `.eq("invoices.invoice_type", "sale")` (lines 47 and 60). The CSV export, chart title (`t("reports.topProducts")`), and table all show only sales data.

### Fix — `src/components/reports/TopProductsChart.tsx`

1. **Add filter state** at top of component:
   ```ts
   const [filter, setFilter] = useState<"sale" | "purchase">("sale");
   ```

2. **Wire filter into both queries** (current period + previous period):
   - Replace `.eq("invoices.invoice_type", "sale")` with `.eq("invoices.invoice_type", filter)` in both queryFns
   - Add `filter` to both `queryKey` arrays so React Query refetches on toggle:
     - `["top-products-items", filter, fromDate, toDate]`
     - `["top-products-prev", filter, ...]`

3. **Add toggle UI** in the existing filter toolbar (next to category Select), using the existing `ToggleGroup`/`ToggleGroupItem` from `@/components/ui/toggle-group`:
   ```tsx
   <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as "sale" | "purchase")}>
     <ToggleGroupItem value="sale">Sales</ToggleGroupItem>
     <ToggleGroupItem value="purchase">Purchases</ToggleGroupItem>
   </ToggleGroup>
   ```

4. **Dynamic chart title** reflecting filter:
   - Sales mode → `t("dashboard.topProducts")` ("Top Selling Products")
   - Purchase mode → "Top Purchased Products" (add new translation key `dashboard.topPurchased` to `LanguageContext.tsx` with EN/UR values)

5. **Update CSV filename** to `top-products-${filter}` so exports don't overwrite each other.

### Translation key to add (`src/contexts/LanguageContext.tsx`)
```ts
"dashboard.topPurchased": { en: "Top Purchased Products", ur: "سب سے زیادہ خریدی گئی مصنوعات" },
```

### Files changed
1. `src/components/reports/TopProductsChart.tsx` — add filter state, toggle UI, dynamic queries + title
2. `src/contexts/LanguageContext.tsx` — add `dashboard.topPurchased` key

No changes to any other report, chart, query, or shared util.

