

# Fix Urdu/RTL Usability

## Core Problems
1. **Noto Nastaliq Urdu font** is a calligraphic Nastaliq script — beautiful for poetry but terrible for UI elements (tables, buttons, badges). It renders with complex vertical strokes that make small text unreadable and misaligns with UI components.
2. **`text-right`** is used throughout tables instead of `text-end`, which doesn't flip properly in RTL mode.
3. **Untranslated strings** like "Overview of your business metrics" remain hardcoded in English.
4. **No line-height/spacing adjustments** for Urdu mode — Urdu script needs more vertical space.
5. **Font size too small** in many places for Urdu text readability.

## Changes

### 1. Switch Font (`src/index.css`)
- Replace Noto Nastaliq Urdu with **Noto Sans Arabic** (Naskh style) — clean, modern, highly readable in UI contexts
- Add `.font-urdu` styles: increased line-height (`leading-relaxed`), slightly larger base font size
- Add RTL-aware utility overrides for table numeric columns

### 2. RTL Text Alignment Fix (multiple files)
Replace all `text-right` with `text-end` in table heads/cells across:
- `src/pages/Products.tsx`
- `src/pages/Sales.tsx`
- `src/pages/Purchases.tsx`
- `src/pages/Expenses.tsx`
- `src/pages/Adjustments.tsx`
- `src/components/reports/AgingReport.tsx`
- `src/components/reports/TopProductsChart.tsx`
- `src/components/reports/FinancialReports.tsx`
- `src/components/reports/CashClosingReport.tsx`
- `src/components/inventory/BatchTracking.tsx`

### 3. Translate Hardcoded Strings (`src/contexts/LanguageContext.tsx`)
- Add `dashboard.subtitle` ("Overview of your business metrics" / "آپ کے کاروبار کا خلاصہ")

### 4. Use Translation on Dashboard (`src/pages/Index.tsx`)
- Replace hardcoded subtitle with `t("dashboard.subtitle")`

### 5. Improve Urdu Spacing in LanguageContext (`src/contexts/LanguageContext.tsx`)
- The wrapper `div` already applies `font-urdu` class in RTL — just need the CSS to handle sizing

### Summary
The biggest win is switching from Nastaliq to Naskh font — this alone will make the Urdu interface dramatically more usable. Combined with proper RTL text alignment and translated strings, the Urdu experience will be clean and professional.

