

## Rename "Total Cash" to "Cash in Hand" and Fix Calculation

### Current State
- The card labeled "Total Cash" sums **all** `amount_paid` from invoices (both sales and purchases), which is meaningless -- it adds money received from sales AND money paid to suppliers together.

### Changes

#### 1. Fix the calculation in `src/pages/Index.tsx`
- Change the query to compute: **(sale payments received) - (purchase payments made) - (expenses)**
- Sum `amount_paid` from sale invoices, subtract `amount_paid` from purchase invoices, subtract total expenses

#### 2. Update translation key in `src/contexts/LanguageContext.tsx`
- Change `"dashboard.totalCash"` from `"Total Cash"` / `"کل نقد"` to `"Cash in Hand"` / `"نقد موجود"`

### Files Changed
- `src/pages/Index.tsx` -- update `totalCash` query logic
- `src/contexts/LanguageContext.tsx` -- rename translation

