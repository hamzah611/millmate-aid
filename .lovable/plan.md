

# Sales & Purchase Analytics — Reports Page

## What will be built

A new `/reports` page with four analytics sections, all using data already in the database (no schema changes needed):

### 1. Top-Selling Products by Revenue
- Bar chart showing top 10 products ranked by total revenue from sale invoices
- Period selector: This Month / Last Month / Last 90 Days / Custom range
- Table below the chart: Product Name, Units Sold (KG), Revenue (₨), % change vs previous period
- Optional category filter dropdown

### 2. Sales vs Purchases Over Time
- Dual-axis line chart showing monthly sales totals and purchase totals
- Date range filter (last 6 months default, customizable)
- Summary cards above the chart: Total Sales, Total Purchases, Net Difference
- Trendline visual built into the line chart

### 3. Profit Margins
- Calculates margin per product: for each product, compare sale revenue vs purchase cost from invoice_items
- Bar chart showing margin % per product
- Summary card for overall margin percentage
- Category filter

### 4. Aging Report (Receivables & Payables)
- Two tabs: Receivables (sale invoices) and Payables (purchase invoices)
- Stacked bar chart showing distribution across aging buckets: 0–7, 8–15, 16–30, 30+ days
- Interactive table: Invoice #, Contact Name, Invoice Date, Due Date, Amount Due, Days Overdue
- Sortable by amount or days overdue

## Technical approach

**Data source**: All analytics are computed client-side from existing `invoices`, `invoice_items`, `products`, `contacts`, and `categories` tables. No new tables or migrations needed.

**Charts**: Uses `recharts` (already installed) via the existing `ChartContainer`, `ChartTooltip` components in `src/components/ui/chart.tsx`.

### New files
| File | Purpose |
|------|---------|
| `src/pages/Reports.tsx` | Main reports page with tab navigation between the 4 sections |
| `src/components/reports/TopProductsChart.tsx` | Bar chart + table for top products by revenue |
| `src/components/reports/SalesPurchasesChart.tsx` | Line chart for sales vs purchases over time |
| `src/components/reports/ProfitMarginsChart.tsx` | Bar chart for profit margins per product |
| `src/components/reports/AgingReport.tsx` | Aging buckets chart + overdue invoices table |

### Modified files
| File | Changes |
|------|---------|
| `src/App.tsx` | Add `/reports` route |
| `src/components/AppSidebar.tsx` | Add Reports nav item with `BarChart3` icon |
| `src/contexts/LanguageContext.tsx` | Add ~20 translation keys for reports UI |

### Implementation order
1. Create `Reports.tsx` page with Tabs layout and route/nav registration
2. Build `TopProductsChart` — queries `invoice_items` joined with `products`, groups by product, sums revenue
3. Build `SalesPurchasesChart` — queries `invoices`, groups by month, separates by `invoice_type`
4. Build `ProfitMarginsChart` — compares sale vs purchase revenue per product from `invoice_items`
5. Build `AgingReport` — queries unpaid invoices with `contacts.payment_terms`, calculates days overdue, buckets them
6. Add all translation keys

