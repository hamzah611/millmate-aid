

## Business Units Implementation

### Overview
Add a nullable `business_unit` text column to `invoices` and `expenses` tables. Wire into create/edit forms, list views, invoice detail, and P&L report filtering. Old records remain untouched (null = Unassigned).

### 1. Database Migration

```sql
ALTER TABLE public.invoices ADD COLUMN business_unit text DEFAULT NULL;
ALTER TABLE public.expenses ADD COLUMN business_unit text DEFAULT NULL;
```

No enum — plain text (`flour_mill`, `rice_hullar`, or null). Backward-compatible.

### 2. Shared Constants

Create `src/lib/business-units.ts` — exports options array and label helper, used everywhere.

### 3. Translation Keys

Add to `src/contexts/LanguageContext.tsx`:

| Key | English | Urdu |
|-----|---------|------|
| `businessUnit.label` | Business Unit | کاروباری اکائی |
| `businessUnit.flourMill` | Al Madina Flour Mill | المدینہ فلور مل |
| `businessUnit.riceHullar` | Al Madina Rice Hullar | المدینہ رائس ہلر |
| `businessUnit.unassigned` | Unassigned | غیر مختص |

### 4. Invoice Form (Create + Edit)

**File:** `src/components/InvoiceForm.tsx`

- Add `businessUnit` state (default `""`)
- **On edit**: initialize from `initialData.business_unit` so existing value is preserved
- Add Business Unit `<Select>` dropdown (Unassigned / Flour Mill / Rice Hullar)
- Include `business_unit: businessUnit || null` in insert/update payload
- Optional — no validation required

### 5. Invoice Detail

**File:** `src/components/InvoiceDetail.tsx`

- Display business unit label if present

### 6. Sales & Purchases List Pages

**Files:** `src/pages/Sales.tsx`, `src/pages/Purchases.tsx`

- Add Business Unit filter dropdown with options: **All**, **Flour Mill**, **Rice Hullar**, **Unassigned**
- "Unassigned" filters for records where `business_unit` is null
- Show business unit as badge/column in table

### 7. Expense Forms (Create + Edit)

**Files:** `src/pages/ExpenseNew.tsx`, `src/pages/ExpenseEdit.tsx`

- Add `businessUnit` state and dropdown
- **ExpenseEdit**: initialize from fetched `expense.business_unit` to preserve on edit
- Include in insert/update payload

### 8. Expenses List Page

**File:** `src/pages/Expenses.tsx`

- Add Business Unit filter dropdown: **All**, **Flour Mill**, **Rice Hullar**, **Unassigned**
- "Unassigned" filters for null values
- Show in table column

### 9. P&L Report (Critical)

**File:** `src/components/reports/FinancialReports.tsx`

- Add `businessUnit` state (default `"all"`) with `<Select>` next to period selector
- Options: **All**, **Al Madina Flour Mill**, **Al Madina Rice Hullar**, **Unassigned**
- Filter invoices and expenses in `useMemo`: when "unassigned", match null; when specific unit, match that value
- Revenue, COGS, expenses, and net profit all reflect the selected filter

### 10. Dashboard

No changes — keep combined view. Priority is reports.

### Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/...` | Add `business_unit` column to `invoices` and `expenses` |
| `src/lib/business-units.ts` | New: shared constants and label helper |
| `src/contexts/LanguageContext.tsx` | Translation keys |
| `src/components/InvoiceForm.tsx` | Add dropdown, preserve on edit via initialData |
| `src/components/InvoiceDetail.tsx` | Display business unit |
| `src/pages/Sales.tsx` | Filter (incl. Unassigned) + display |
| `src/pages/Purchases.tsx` | Filter (incl. Unassigned) + display |
| `src/pages/ExpenseNew.tsx` | Add dropdown + save |
| `src/pages/ExpenseEdit.tsx` | Add dropdown, init from existing data, save |
| `src/pages/Expenses.tsx` | Filter (incl. Unassigned) + display |
| `src/components/reports/FinancialReports.tsx` | Business unit filter on P&L (incl. Unassigned) |

