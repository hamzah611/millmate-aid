

## Plan: Add Opening & Closing Stock to P&L (proper COGS)

Update `src/components/reports/FinancialReports.tsx` only. Replace `Gross Profit = Sales − Purchases` with the proper accounting formula:

```
COGS = Opening Stock + Purchases − Closing Stock
Gross Profit = Sales − COGS
Net Profit = Gross Profit − Expenses
```

### Changes in `ProfitLossReport`

**1. New query — products + units** (for stock valuation):
```ts
const { data: stockData } = useQuery({
  queryKey: ["pnl-stock", fromDate, toDate],
  queryFn: async () => {
    const [{ data: products }, { data: units }, { data: saleItems }, { data: purchaseItems }] = await Promise.all([
      supabase.from("products").select("id, stock_qty, avg_cost, default_price, unit_id"),
      supabase.from("units").select("id, kg_value"),
      supabase.from("invoice_items")
        .select("product_id, quantity, unit_id, invoices!inner(invoice_date, invoice_type)")
        .eq("invoices.invoice_type", "sale")
        .gte("invoices.invoice_date", fromDate)
        .lte("invoices.invoice_date", toDate),
      supabase.from("invoice_items")
        .select("product_id, quantity, unit_id, invoices!inner(invoice_date, invoice_type)")
        .eq("invoices.invoice_type", "purchase")
        .gte("invoices.invoice_date", fromDate)
        .lte("invoices.invoice_date", toDate),
    ]);
    return { products: products || [], units: units || [], saleItems: saleItems || [], purchaseItems: purchaseItems || [] };
  },
});
```

**2. Extend `pnl` memo** — derive opening/closing values:
- Build `unitMap` from units.
- For each product: compute `purchasedKg`, `soldKg` in period using the item's unit's `kg_value`.
- `openingKg = max(0, currentStockKg − purchasedKg + soldKg)`.
- `openingStockValue += (openingKg / kgValue) * (avg_cost || default_price || 0)`.
- `closingStockValue += (currentStockKg / kgValue) * (avg_cost || default_price || 0)`.
- Round both.
- `cogs = round(openingStockValue + purchaseCost − closingStockValue)`.
- `grossProfit = round(saleRevenue − cogs)`.
- `netProfit = round(grossProfit − operatingExpenses)`.
- `marginPct = saleRevenue > 0 ? (netProfit / saleRevenue) * 100 : 0`.
- Keep existing `purchaseCost` (raw purchases) for the breakdown row.

**3. Loading gate** — include `stockData` in the loading check.

**4. P&L statement table** — replace current rows with hierarchical layout:
```
Sales Revenue                    XXX     (bold)
  Opening Stock                  XXX     (indent)
  + Purchases                    XXX     (indent)
  − Closing Stock              (XXX)     (indent, negative styling)
  = Cost of Goods Sold        (XXX)     (indent, bold)
  ───
Gross Profit                     XXX     (bold)
  Operating Expenses             XXX     (indent)
  ───
Net Profit                       XXX     (bold, green/red)
```
Use existing `StatRow` (with `indent` and `negative` props). `StatRow` already shows `(-)` for negative — pass closing stock as a negative value so it renders with the deduction style.

**5. Top KPI cards** — keep three cards but update middle card label from "COGS" displaying raw purchases to actually showing the new COGS value (`pnl.cogs`). Revenue and Net Profit cards unchanged.

**6. CSV export** — update rows:
```
Total Revenue, Opening Stock, Purchases, Closing Stock, COGS, Gross Profit, Operating Expenses, Net Profit
```

**7. New translation keys in `src/contexts/LanguageContext.tsx`**:
- `reports.openingStock` → en: "Opening Stock", ur: "ابتدائی اسٹاک"
- `reports.closingStock` → en: "Closing Stock", ur: "اختتامی اسٹاک"
- `reports.purchases` → en: "Purchases", ur: "خریداری"
(Reuse existing `reports.cogs`, `reports.grossProfit`, `reports.netProfit`, `reports.operatingExpenses`.)

### Notes / behavior

- **Period definition**: opening stock is derived from current `stock_qty` minus net inventory movement during the period (purchases − sales in kg). This matches the spec exactly. Caveat: production transfers, adjustments, and deletions outside this window aren't accounted for — same limitation as the spec; not solving it here.
- **Loan / fixed-asset filter**: existing exclusion of loan/fixed-asset invoices from `saleRevenue`/`purchaseCost` stays in place. Stock movement queries (`invoice_items`) are not filtered by contact category — fixed-asset purchases never create `invoice_items` for tradeable products in normal flow, so impact is negligible.
- **Negative opening stock**: clamped to 0 (spec).
- **Cost fallback**: `avg_cost || default_price || 0` (spec).

### Out of scope
- `BalanceSheetProfessional.tsx` — untouched.
- `financial-utils.ts` `calculateInventoryValue` — untouched.
- Cash Flow report, Breakdown table — untouched.

### Files changed
1. `src/components/reports/FinancialReports.tsx`
2. `src/contexts/LanguageContext.tsx`

