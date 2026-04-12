

## Rewrite Daily Products Report as "Sales Summary"

### Current State
- The `invoice_items` table has: quantity, price_per_unit, total, unit_id — but NO weight, kaat, or net_weight columns
- Current data shows quantity is stored in maunds (unit "Mun & KG", kg_value=40)
- "Cash Sale" contact (account_category = "current_assets") is the cash sales account

### Approach
Since weight/kaat/net_weight don't exist in the DB yet, the report will derive values:
- **QTY** = quantity (raw value)
- **WEIGHT** = quantity × kg_value (converted to KG)
- **KAAT** = 0 (no data — column shown as placeholder for future use)
- **NET WEIGHT** = WEIGHT - KAAT
- **RATE** = price_per_unit
- **AS PER** = unit name (e.g., "MND")
- **AMOUNT** = total
- **DESCRIPTION** = contact name, or "CASH SALES" if contact is "Cash Sale"

### File 1: `src/components/reports/DailyProductsReport.tsx` — Full Rewrite

**Header section:**
- Business name: "Al Madina Flour Mill"
- Address: "Sitta Road, Khairpur Nathan Shah"
- Phone: "0309-1311499, 0345-3551100"
- Title: "SALES SUMMARY FROM: [from date] TO: [to date]"

**Date range picker:** Two date pickers (From / To) replacing the single date picker.

**Data query:**
- Fetch sale invoice_items joined with invoices, products, contacts, and units for the date range
- Filter only `invoice_type = 'sale'`
- Group results by product into 4 sections: ATTA RICE (Rice Atta), ATTA WHEAT (Wheat Atta), CHILL (Chill), POWDER (Powder)

**Table columns (exact order):**
DATED | INV # | DESCRIPTION | QTY | WEIGHT | KAAT | NET WEIGHT | RATE | AS PER | AMOUNT

**Product sections:**
- Each section has a header row with product name
- Rows underneath show individual sale entries
- Subtotal row at bottom of each section with totals for QTY, WEIGHT, KAAT, NET WEIGHT, avg RATE, total AMOUNT

**Grand Total row:** Sums QTY, NET WEIGHT, and AMOUNT across all sections.

**Export/Print:** CSV export and window.print buttons retained.

### File 2: `src/pages/Reports.tsx` — Minor Update
- Change tab label from "Daily Products" to "Sales Summary"

### No database changes needed.
The KAAT column will display 0 for all entries until kaat tracking is added to the invoice form and database in a future update.

