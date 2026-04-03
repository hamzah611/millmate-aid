

## Make Balance Sheet More Readable

### Current Issues
- Text is small (text-sm/text-xs everywhere), making numbers hard to scan
- Line items are tightly packed with minimal spacing
- Section headers blend into content
- No visual separation between line items (no alternating backgrounds or dividers)
- Collapsible chevrons are tiny and easy to miss
- The two columns have uneven visual weight

### Changes (single file: `src/components/reports/FinancialReports.tsx`)

**1. Increase font sizes and spacing**
- `BSLineItem`: bump from `text-sm` to `text-base`, increase vertical padding from `py-1.5` to `py-2.5`
- `BSCollapsibleItem`: same size increase, add subtle bottom border between items
- `BSSubLine`: bump from `text-xs` to `text-sm` for better readability inside drill-downs
- `BSTotalRow`: bump from `text-base` to `text-lg`
- Bank detail lines inside collapsible: bump from `text-[10px]` to `text-xs`

**2. Add visual separation between rows**
- Add light bottom borders (`border-b border-border/30`) on each line item row
- Add alternating subtle background on collapsible sub-items for contrast

**3. Improve section headers**
- Make `BSSectionHeader` taller with larger text (`text-sm` instead of `text-xs`)
- Add more vertical margin above/below sections

**4. Better number alignment**
- Ensure all amounts use consistent right-alignment with enough width
- Make the chevron icon slightly larger (`h-4 w-4`)

**5. Card header improvements**
- Increase card header title from `text-base` to `text-lg`
- Add slightly more padding in card content

**6. Balance confirmation footer**
- Increase font size from `text-sm` to `text-base`

### No logic or data changes — purely visual/CSS adjustments.

