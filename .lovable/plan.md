

## Fix Core Accuracy Issues: Units + Cash/Bank + Dashboard

### Confirmed Issues Found

**Issue 1 — Unit display is wrong everywhere (except Inventory Breakdown)**

`stock_qty` is stored in KG internally (e.g., Chill = 1107 KG). The product's unit is Mun (1 Mun = 40 KG), so Chill = 27.68 Mun. But the UI shows **"1107 Mun"** — raw KG with the wrong label. This is the "27 Mun shown as 1107 Mun" problem.

Affected locations:
- **Products.tsx** line 181 — stock badge shows `p.stock_qty` with unit name directly
- **Index.tsx** line 225 — low stock widget shows `p.stock_qty` with unit name
- **ReplenishmentAlerts.tsx** line 185 — stock column shows raw `stock_qty` with unit name
- **ReplenishmentAlerts.tsx** chart data (line 102) — uses raw `stock_qty` for chart bars
- **Products.tsx** line 65 — stock value calculation uses `stock_qty * avgCost` but stock is KG and avgCost is per display unit

**Not broken**: `InventoryBreakdown.tsx` and `financial-utils.ts` correctly convert via `stockQty / kgValue`.

---

**Issue 2 — Cash in Hand includes bank payments**

Current formula in `Index.tsx`:
```
openingCash + SUM(invoices.amount_paid WHERE sale) - SUM(invoices.amount_paid WHERE purchase) - cashExpenses
```

Problem: `invoices.amount_paid` is the total paid across ALL payment methods (cash + bank). The `payments` table has a `payment_method` field that distinguishes cash vs bank, but the dashboard ignores it entirely.

Fix: Use the `payments` table (which has `payment_method`) to calculate cash movement. For initial invoice payments with no payment record, compute the difference and treat as cash (since invoice form doesn't capture method).

---

**Issue 3 — Bank Balance only shows opening balance**

Current bank balance = opening balance from bank-category contacts only. It does NOT include bank-method payment movements (receipts received via bank, payments made via bank). This makes it static and incorrect after day one.

Fix: Add bank-method payment inflows/outflows to the bank balance calculation.

---

**Issue 4 — CashClosingReport has same cash/bank mixing problem**

The `CashClosingReport.tsx` uses `invoices.amount_paid` as "cash from sales/purchases" without filtering by payment method. Same contamination as dashboard.

---

### Plan by File

#### 1. `src/pages/Products.tsx`
- Fetch `units` with `kg_value` (already fetched but without `kg_value`)
- Convert `stock_qty` display: `stock_qty / kg_value` before showing with unit name
- Fix `getStockValue`: use `(stock_qty / kg_value) * avgCost` instead of `stock_qty * avgCost`

#### 2. `src/pages/Index.tsx` — Low Stock Widget
- Fetch units with `kg_value`
- Convert `p.stock_qty / kg_value` before displaying with unit name

#### 3. `src/pages/Index.tsx` — Cash in Hand
Replace current formula with:
- Fetch all payments grouped by `payment_method` and `voucher_type`
- Cash in = SUM(payments WHERE method='cash' AND type='receipt')
- Cash out = SUM(payments WHERE method='cash' AND type='payment')
- Also compute "untracked initial payments" = invoice.amount_paid minus SUM(payments for that invoice), treat as cash
- Cash expenses already filtered correctly
- Final: `openingCash + cashIn + untrackedInitialPayments(sale) - cashOut - untrackedInitialPayments(purchase) - cashExpenses`

#### 4. `src/pages/Index.tsx` — Bank Balance
Change from static opening balance to:
- `openingBank + SUM(payments WHERE method='bank' AND type='receipt') - SUM(payments WHERE method='bank' AND type='payment')`

#### 5. `src/components/inventory/ReplenishmentAlerts.tsx`
- Fetch units with `kg_value`
- Convert stock display in table: `stock_qty / kg_value` with unit name
- Convert chart data: use converted values, not raw KG

#### 6. `src/components/reports/CashClosingReport.tsx`
- Filter payments by `payment_method` in the query
- Only count cash-method payments as "cash in/out"
- Properly label bank-method payments separately or exclude from cash totals

---

### What Will NOT Change
- KG-based internal storage (correct and intentional)
- Schema / table structure
- Invoice creation flow
- Inventory valuation in `financial-utils.ts` (already correct)
- InventoryBreakdown dialog (already correct)
- Opening balance logic structure
- No new features added

