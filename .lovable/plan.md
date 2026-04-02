

## Visually Upgrade All Charts

### Summary
Enhance every chart across the dashboard and reports with modern styling: gradient fills, rounded bars, refined grid lines, better tooltips, area fills under line charts, custom colors per bar segment, smooth animations, and polished axis styling. This touches 6 chart files.

---

### Changes by File

#### 1. `src/components/dashboard/TopSellingProducts.tsx`
- Add `defs` with a vertical gradient for bars (primary color fading to transparent)
- Use `fill="url(#barGradient)"` on the Bar
- Soften grid: `stroke="hsl(var(--border))"` with `opacity={0.4}`, remove dashes
- Style axes: `stroke="transparent"`, muted tick color `fill="hsl(var(--muted-foreground))"`
- Increase bar radius to `[8, 8, 0, 0]`
- Add `animationDuration={800}`

#### 2. `src/components/reports/TopProductsChart.tsx`
- Add horizontal gradient `defs` for the horizontal bar chart
- Soften CartesianGrid with lower opacity, horizontal-only lines (`vertical={false}`)
- Restyle axis ticks with muted foreground color, hide axis lines
- Increase bar radius to `[0, 8, 8, 0]`
- Add gradient fill `url(#topProductGradient)`

#### 3. `src/components/reports/SalesPurchasesChart.tsx`
- Convert from plain `LineChart` to `AreaChart` with `Area` components using gradient fills
- Add two `linearGradient` defs: blue for sales, orange for purchases
- `fillOpacity={0.15}` for subtle area shading under lines
- Thicker strokes (`strokeWidth={2.5}`), smooth `type="monotone"`
- Dot styling: `fill="white"`, `strokeWidth={2}`, `r={5}` with larger active dot
- Softer grid, hide axis lines, muted tick colors

#### 4. `src/components/reports/ProfitMarginsChart.tsx`
- Add conditional bar coloring: green gradient for positive margins, red for negative
- Use `Cell` from recharts to color each bar individually based on margin value
- Softer grid (horizontal only), hide axis lines
- Better bar radius `[0, 8, 8, 0]`

#### 5. `src/components/reports/AgingReport.tsx`
- Color each aging bucket bar differently using `Cell`:
  - 0-7 days: green (`hsl(var(--chart-2))`)
  - 8-15 days: yellow/amber
  - 16-30 days: orange (`hsl(var(--chart-3))`)
  - 30+ days: red (`hsl(var(--chart-5))`)
- Add rounded corners `[8, 8, 0, 0]`
- Softer grid, hide axis lines, muted tick colors

#### 6. `src/components/reports/CashClosingReport.tsx` (no chart, skip)

#### 7. `src/components/reports/FinancialReports.tsx` (table-based, no charts to upgrade)

### Shared Styling Patterns
All charts will use these consistent improvements:
- `CartesianGrid`: `strokeDasharray` removed, `stroke="hsl(var(--border))"`, `opacity={0.4}`, `vertical={false}`
- `XAxis` / `YAxis`: `axisLine={false}`, `tickLine={false}`, tick fill `"hsl(var(--muted-foreground))"`, fontSize 11-12
- Bar radius increased to 8px corners
- Gradient `defs` for fills where applicable
- Consistent animation duration

### Summary Card Visual Upgrades
For all summary stat cards across reports (Sales vs Purchases, P&L, Cash Flow, Balance Sheet):
- Add a subtle colored left border accent matching the stat type (green for positive, red for negative, blue for neutral)
- This is done via `className="border-l-4 border-l-green-500"` etc.

### Files Changed

| File | Change |
|------|--------|
| `TopSellingProducts.tsx` | Gradient bars, softer grid, polished axes |
| `TopProductsChart.tsx` | Gradient horizontal bars, refined styling |
| `SalesPurchasesChart.tsx` | Convert to area chart with gradient fills |
| `ProfitMarginsChart.tsx` | Conditional bar colors (green/red), gradient |
| `AgingReport.tsx` | Color-coded bucket bars, rounded corners |

