

## PDF Statement Exports for Contact Ledger & Product History

### Overview
Add professional PDF export buttons to ContactLedger.tsx and ProductHistory.tsx using jspdf + jspdf-autotable. Keep existing CSV exports intact.

### Step 0 — Install dependencies
`npm install jspdf jspdf-autotable`

### Step 1 — Create shared PDF utility (`src/lib/export-pdf.ts`)
A reusable helper with:
- `drawPdfHeader(doc, title)` — draws "Al Madina Flour Mill" top-left, title top-right, horizontal line
- `drawPdfFooter(doc)` — "This is a computer generated statement" + page numbers
- Common formatting constants (colors, fonts, margins)

### Step 2 — Contact Statement PDF (`ContactLedger.tsx`)

**New function `handleExportPDF`:**
- Uses jsPDF in portrait A4
- **Header**: "Al Madina Flour Mill" (bold, 18pt left), "Account Statement" (14pt right), separator line
- **Contact info**: Name, Type, Date range (or "All Transactions"), Generated date
- **Summary box**: 4-column autoTable — Total Sales | Total Purchases | Total Paid | Outstanding Balance — with bordered cells
- **Ledger table** via autoTable:
  - Columns: Date | Reference | Description | Debit | Credit | Balance
  - First row (opening balance) gets gray background via `willDrawCell` hook
  - Alternating row colors via `alternateRowStyles`
  - Balance column formatted as "X DR" or "X CR" with red/green color via `didParseCell` hook
  - All amounts formatted with `fmtAmount`
- **Footer**: Closing balance bold bottom-right, disclaimer text, page numbers via `didDrawPage` hook

**UI change**: Add "Download PDF" button (primary) next to existing CSV button (which stays as outline).

### Step 3 — Product Statement PDF (`ProductHistory.tsx`)

**New function `handleExportPDF`:**
- Portrait A4
- **Header**: "Al Madina Flour Mill" + "Product Statement" + date
- **Product info**: Name, Current Stock + unit, Avg Cost
- **Summary**: Total Purchased | Total Sold (2-column box)
- **Transaction table** via autoTable:
  - Columns: Date | Type | Reference | Qty In | Qty Out | Rate | Value | Balance
  - Green text for Qty In values, red for Qty Out via `didParseCell`
  - All quantities via `fmtQty`, amounts via `fmtAmount`
- **Expenses table** (if expenses exist): Date | Notes | Category | Amount, with total row
- **Footer**: Page numbers + disclaimer

**UI change**: Add "Download PDF" button next to the back button area.

### Files changed

| File | Change |
|---|---|
| `src/lib/export-pdf.ts` | **New** — shared PDF header/footer helpers |
| `src/pages/ContactLedger.tsx` | Add `handleExportPDF`, add PDF button, keep CSV button |
| `src/pages/ProductHistory.tsx` | Add `handleExportPDF`, add PDF button |

### No database changes needed.

