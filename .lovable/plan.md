

## Improve Sale & Purchase Invoice Form UX

### Problems Identified
1. **Line items use a cramped 12-column grid** with tiny Select dropdowns and no visible labels per row -- hard to scan
2. **No keyboard shortcut** to add items (must click button)
3. **Contact select** uses Radix Select which isn't searchable -- slow for many contacts
4. **Product select** in each row also not searchable
5. **Totals section** uses a 2-column grid that misaligns labels and inputs
6. **No notes/date field** on the form despite the DB supporting `notes` and `invoice_date`
7. **No auto-focus** -- user has to click to start entering data
8. **"Add Item" button** is small and easy to miss; no empty state guidance

### Plan

#### 1. Redesign InvoiceItemRow as a card-style row
- Switch from 12-col grid to a cleaner stacked layout on mobile, table-like on desktop
- Add row numbers for clarity
- Auto-focus the quantity field when a product is selected
- Add `onKeyDown` handler: pressing **Enter** on the price field adds a new row and focuses it
- Show stock available badge next to product name (for sales)

#### 2. Make Contact & Product selects searchable
- Replace `<Select>` with `<Popover>` + `<Command>` (cmdk) pattern (already installed) for both contact and product selection
- This enables type-to-filter which is much faster with keyboard

#### 3. Improve form layout & sections
- Add `invoice_date` field (date input, defaults to today)
- Add `notes` textarea (optional, collapsible)
- Group form into clear visual sections with section headers: **Party**, **Items**, **Summary**, **Payment**
- Totals section: use a right-aligned summary panel (like a receipt) instead of a grid

#### 4. Keyboard workflow optimizations
- Auto-focus contact select on mount
- After selecting contact, focus "Add Item" or auto-add first empty row
- Tab order flows naturally: Product → Unit → Qty → Price → (Enter = new row)
- `Ctrl+S` / `⌘+S` keyboard shortcut to save
- `Escape` to cancel

#### 5. Better empty state
- When no items added, show a centered prompt "Add your first item" with the add button prominently displayed

### Files Changed
- `src/components/InvoiceForm.tsx` -- restructured layout, added date/notes fields, searchable contact, keyboard shortcuts, section headers, receipt-style totals
- `src/components/InvoiceItemRow.tsx` -- searchable product combobox, auto-focus logic, Enter-to-add-row callback, row number, stock badge
- `src/contexts/LanguageContext.tsx` -- add missing translation keys (`invoice.notes`, `invoice.invoiceDate`, `invoice.searchProduct`, `invoice.searchContact`, `invoice.emptyItems`)

