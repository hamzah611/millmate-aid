

## Phase 2: System Stability & Accuracy Fix

Five targeted fixes for confirmed issues. No new features, no schema changes.

---

### 1. Fix Unit Display — Remove Hardcoded "KG"

**Problem**: 7 locations hardcode "KG" instead of showing the product's actual unit.

**Fix**: Fetch units alongside products wherever stock is displayed. Show unit name instead of "KG".

**Files and specific changes**:

| Location | File | Current | Fix |
|----------|------|---------|-----|
| Low Stock widget | `src/pages/Index.tsx:210` | `{p.stock_qty} KG` | `{p.stock_qty} {unitName}` |
| Inactive Products | `src/components/dashboard/InactiveProducts.tsx:63` | `{p.stock_qty} KG` | `{p.stock_qty} {unitName}` |
| Production New | `src/pages/ProductionNew.tsx:116` | `({p.stock_qty} KG)` | `({p.stock_qty} {unitName})` |
| Notifications | `src/components/NotificationPanel.tsx:35` | `(${p.stock_qty} KG)` | `(${p.stock_qty} ${unitName})` |
| Invoice Item Row | `src/components/InvoiceItemRow.tsx:82` | `${p.stock_qty} kg` | `${p.stock_qty} ${unitName}` |
| Invoice stock warning | `src/components/InvoiceItemRow.tsx:308` | hardcoded `kg` | use unit name |
| Replenishment table | `src/components/inventory/ReplenishmentAlerts.tsx` | no unit shown | add unit |

**Approach**: Each component already queries products. Add `unit_id` to the select (if not already there), fetch units list, and look up unit name. Create a tiny helper: `getUnitName(unitId, units)` that returns the unit name or empty string.

---

### 2. Fix Cash Flow Report — Include Expenses

**Problem**: `CashFlowReport` in `FinancialReports.tsx` (lines 272-393) only counts invoice `amount_paid` for inflows/outflows. Expenses are completely missing.

**Fix**: Add an expenses query filtered by date range and `payment_method = 'cash'`. Subtract from net cash flow.

```text
Cash Inflows:  sale invoice amount_paid (existing)
Cash Outflows: purchase invoice amount_paid (existing)
               + cash expenses (NEW)
Net Cash Flow: inflows - outflows
```

**Changes in `FinancialReports.tsx`**:
- Add query: `expenses` table filtered by `fromDate`/`toDate` and `payment_method = 'cash'`
- Update `flow` calculation: `totalOutflow += totalCashExpenses`
- Add a new indented row in the cash flow statement table: "Operating Expenses (Cash)"
- Update CSV export to include the expenses line

---

### 3. Fix Balance Sheet — Add Retained Earnings

**Problem**: Balance sheet shows Assets, Liabilities, and Capital but doesn't balance because there's no retained earnings / difference line.

**Fix**: Compute `retainedEarnings = totalAssets - totalLiabilities - capitalEquity` and display it in the Equity section.

**Changes in `FinancialReports.tsx` (BalanceSheetReport)**:
- After line 484, compute: `const retainedEarnings = totalAssets - totalLiabilities - capitalEquity;`
- Add row after "Closing Accounts": `Retained Earnings / Balance Difference`
- Update equity summary card to show `capitalEquity + retainedEarnings`
- Update CSV export to include retained earnings line
- Add translation key: `reports.retainedEarnings` — "Retained Earnings" / "جمع شدہ منافع"

---

### 4. Fix Employee Receivables on Dashboard

**Problem**: Employee receivables (₨237,910) exist but are invisible on the dashboard.

**Fix**: Add an 8th summary card "Employee Advances" to the dashboard.

**Changes in `src/pages/Index.tsx`**:
- The `fetchCategoryBalances()` call already returns `employeeReceivables`
- Add to `summaryCards` array: `{ key: "dashboard.employeeAdvances", icon: Users, value: ..., colorKey: "employee" }`
- Add `employee` to `iconBg` map
- Import `Users` icon from lucide-react
- Grid stays at `xl:grid-cols-7` (wraps naturally with 8 cards on smaller screens) or adjust to `xl:grid-cols-8` if space allows
- Add translation key: `dashboard.employeeAdvances` — "Employee Advances" / "ملازمین ایڈوانس"

---

### 5. Fix Invoice Contact Validation

**Problem**: InvoiceForm allows selecting any contact_type, but the filter already restricts to `customer`/`both` for sales and `supplier`/`both` for purchases. However, it doesn't filter by `account_category`.

**Current state**: `InvoiceForm.tsx` line 54-56 already filters by `contact_type`:
```typescript
const contactFilter = type === "sale"
  ? ["customer", "both"] as const
  : ["supplier", "both"] as const;
```

This is actually already correct — cash/bank/closing/employee contacts have `contact_type` of `customer` or `supplier` only if they were set that way. The real risk is contacts with `account_category` = `cash`/`bank`/`closing` being used in invoices.

**Fix**: Add `account_category` exclusion to the contacts query:
- Exclude contacts where `account_category` is `cash`, `bank`, or `closing` from invoice contact selection
- Add `.not('account_category', 'in', '("cash","bank","closing")')` to the contacts query in InvoiceForm

---

### 6. Inventory Limitation — Code Comment Only

Add a comment block in `src/pages/Index.tsx` (inventory value query) and `src/components/reports/FinancialReports.tsx` (inventory section) noting:
```
// KNOWN LIMITATION: Opening stock was injected directly into stock_qty
// without purchase transaction history. Many products have default_price = 0.
// Inventory valuation may be understated until real purchase invoices exist.
```

---

### Translation Keys to Add

| Key | English | Urdu |
|-----|---------|------|
| `reports.retainedEarnings` | Retained Earnings | جمع شدہ منافع |
| `reports.cashExpenses` | Operating Expenses (Cash) | آپریٹنگ اخراجات (نقد) |
| `dashboard.employeeAdvances` | Employee Advances | ملازمین ایڈوانس |

---

### Files Changed Summary

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Fix KG in low stock; add employee advances card; add comment |
| `src/components/dashboard/InactiveProducts.tsx` | Fix KG display |
| `src/components/NotificationPanel.tsx` | Fix KG display |
| `src/pages/ProductionNew.tsx` | Fix KG display |
| `src/components/InvoiceItemRow.tsx` | Fix kg display |
| `src/components/inventory/ReplenishmentAlerts.tsx` | Add unit display |
| `src/components/reports/FinancialReports.tsx` | Add expenses to cash flow; add retained earnings to balance sheet; add comment |
| `src/components/InvoiceForm.tsx` | Exclude cash/bank/closing contacts |
| `src/contexts/LanguageContext.tsx` | Add 3 translation keys |

No database changes needed.

