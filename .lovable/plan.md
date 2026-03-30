

## Fix 3 Issues in Inventory Adjustments

### Fix 1: Date Timezone Offset
**Problem**: `format(new Date(), "yyyy-MM-dd")` and `new Date(adj.adjustment_date)` can shift dates due to UTC parsing.

**Changes in `AdjustmentNew.tsx`**:
- Replace `format(new Date(), "yyyy-MM-dd")` with `new Date().toISOString().split("T")[0]` or keep as-is (it's local time, should be fine)
- The real issue is in the list page date display

**Changes in `Adjustments.tsx`**:
- Fix `format(new Date(adj.adjustment_date), "dd/MM/yyyy")` — when parsing a date-only string like `"2026-03-28"`, `new Date()` interprets it as UTC midnight, which shifts back a day in positive-offset timezones
- Fix: parse the date string manually or append `T00:00:00` to force local interpretation: `format(new Date(adj.adjustment_date + "T00:00:00"), "dd/MM/yyyy")`

### Fix 2: Validation Feedback
**Problem**: Save button disables silently with no explanation when fields are missing.

**Changes in `AdjustmentNew.tsx`**:
- Change save button to always be enabled (except during `isPending`)
- In the mutation handler, validate fields and show specific toast errors before proceeding:
  - "Please select a product"
  - "Please enter a quantity"
  - "Please select a reason"
- Show field-level red border on missing required fields using a `submitted` state flag

### Fix 3: Read-Only Detail Dialog
**Problem**: No way to view full adjustment details from the list (notes are truncated).

**Changes in `Adjustments.tsx`**:
- Add a `Dialog` that opens when clicking a table row
- Show all fields in a clean read-only layout: adjustment number, date, product, type, quantity, reason, full notes
- No edit capability (immutable records)

### Translation Keys
Add to `LanguageContext.tsx`:
- `adjustments.validationProduct` → "Please select a product" / "براہ کرم پروڈکٹ منتخب کریں"
- `adjustments.validationQuantity` → "Please enter a quantity" / "براہ کرم مقدار درج کریں"
- `adjustments.validationReason` → "Please select a reason" / "براہ کرم وجہ منتخب کریں"
- `adjustments.details` → "Adjustment Details" / "ایڈجسٹمنٹ کی تفصیلات"

### Files Changed
| File | Change |
|------|--------|
| `src/pages/AdjustmentNew.tsx` | Validation toasts + field highlights on save attempt |
| `src/pages/Adjustments.tsx` | Fix date timezone parsing, add detail dialog on row click |
| `src/contexts/LanguageContext.tsx` | 4 new translation keys |

