

## Phase 3: Inventory Accuracy, Data Integrity & UX Fixes

### Confirmed Issues from Code Audit

#### 1. Hardcoded "KG" Fallback (5 locations)
The Phase 2 fix changed some labels but left `"KG"` as the fallback string in `getUnitName()` helpers across multiple files. Since some products may legitimately have no unit assigned, the fallback should be empty string (not "KG") — the unit should come from the product definition only.

**Files with `return "KG"` fallback to fix:**
| File | Lines |
|------|-------|
| `src/pages/Index.tsx` | Line 235: `getUnitName(...) \|\| "KG"` |
| `src/components/dashboard/InactiveProducts.tsx` | Lines 19, 21: fallback `"KG"` |
| `src/components/NotificationPanel.tsx` | Lines 29, 31: fallback `"KG"` |
| `src/components/InvoiceItemRow.tsx` | Lines 81, 310: fallback `"KG"` |
| `src/pages/ProductionNew.tsx` | Lines 49, 51: fallback `"KG"`, Line 156: placeholder `"KG"` |

**Fix**: Change all `"KG"` fallbacks to `""` (empty string). If a product has no unit assigned, show nothing rather than an incorrect label.

#### 2. Inventory Value = ₨0 (CRITICAL)
Every product in the database has `default_price = 0` and there are zero purchase invoices. The current valuation logic falls back to `stock_qty * default_price`, which yields 0.

**Fix approach**: This is a data problem, not a code bug. The code logic is correct (weighted average cost → fallback to default_price). Since we cannot fabricate prices:
- Add a visible warning on the dashboard Inventory Value card when value is 0 but stock exists: small text "⚠ No cost data"
- Add same warning on Balance Sheet inventory line
- Do NOT change the calculation — it's already correct for when real purchases arrive

#### 3. Recent Activity — Show More (UX)
Currently hardcoded to 10 items with no expand option.

**Fix**: Add a "Show more" toggle that expands from 10 to 25 items. Use local state, no new queries needed (fetch 25 upfront, display 10 initially).

#### 4. ESC Keyboard Shortcut
Add a global `useEffect` for ESC key that triggers `navigate(-1)` on form pages (SaleNew, PurchaseNew, ExpenseNew, ContactNew, ProductNew, ProductionNew, AdjustmentNew, BatchNew).

**Fix**: Create a small hook `useEscapeBack()` and add it to each form page component.

#### 5. Invoice Contact Validation — Error Message
The Phase 2 fix filters out cash/bank/closing contacts from the dropdown silently. This is correct behavior. No additional error message needed — invalid contacts simply don't appear.

**Already working — no change needed.**

---

### Files Changed Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Remove `\|\| "KG"` fallback; add inventory warning hint |
| `src/components/dashboard/InactiveProducts.tsx` | Change `"KG"` fallback to `""` |
| `src/components/NotificationPanel.tsx` | Change `"KG"` fallback to `""` |
| `src/components/InvoiceItemRow.tsx` | Change `"KG"` fallback to `""` |
| `src/pages/ProductionNew.tsx` | Change `"KG"` fallback to `""`, remove placeholder |
| `src/components/dashboard/RecentActivity.tsx` | Add show more/less toggle (10→25) |
| `src/hooks/useEscapeBack.ts` | **New** — ESC key hook |
| `src/pages/SaleNew.tsx` | Add `useEscapeBack()` |
| `src/pages/PurchaseNew.tsx` | Add `useEscapeBack()` |
| `src/pages/ExpenseNew.tsx` | Add `useEscapeBack()` |
| `src/pages/ContactNew.tsx` | Add `useEscapeBack()` |
| `src/pages/ProductNew.tsx` | Add `useEscapeBack()` |
| `src/pages/ProductionNew.tsx` | Add `useEscapeBack()` |
| `src/pages/AdjustmentNew.tsx` | Add `useEscapeBack()` |
| `src/pages/BatchNew.tsx` | Add `useEscapeBack()` |

No database changes needed.

### What This Does NOT Touch
- No voucher system
- No schema changes
- No financial logic changes
- No inventory system redesign
- Balance sheet / cash flow logic stays as-is from Phase 2

