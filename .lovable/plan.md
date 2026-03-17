

## Usability Upgrades: Sub-Units, Horizontal Layout, Broker Support

### 1. Database Changes

**A. Add sub-unit support to `units` table**
```sql
ALTER TABLE units ADD COLUMN sub_unit_id uuid REFERENCES units(id);
```
This lets any unit optionally point to a smaller unit (Maund → KG, KG → Gram, Bag → KG). No hardcoding.

**B. Add `broker` to `contact_type` enum**
```sql
ALTER TYPE contact_type ADD VALUE 'broker';
```
Brokers are contacts that can be selected on purchase invoices.

**C. Add broker fields to `invoices` table**
```sql
ALTER TABLE invoices
  ADD COLUMN broker_contact_id uuid REFERENCES contacts(id),
  ADD COLUMN broker_commission_rate numeric DEFAULT 0,
  ADD COLUMN broker_commission_unit_id uuid REFERENCES units(id),
  ADD COLUMN broker_commission_total numeric DEFAULT 0;
```
All nullable/defaulted — purchase invoices without brokers work as before.

---

### 2. Sub-Unit Quantity Entry in Invoice Item Rows

**Current**: Single `quantity` field (decimal). User enters `3.125` for 3 Maund + 5 KG.

**New**: When the selected unit has a `sub_unit_id`, show two compact inline inputs:

```
[Product ▼] [Unit ▼] [Main Qty: 3] + [Extra KG: 5] [Price] [Total] [🗑]
```

- `InvoiceItem` interface gets two new UI-only fields: `main_qty` and `sub_qty`
- The real `quantity` is computed: `main_qty + (sub_qty / unit.kg_value * sub_unit.kg_value)` — but actually simpler: `(main_qty * unit.kg_value + sub_qty * sub_unit.kg_value) / unit.kg_value`
- The stored `quantity` in the DB remains in terms of the selected unit (for price calculation). The KG conversion happens via `quantity * unit.kg_value` as it does today.
- Actually, to keep calculations simple: store quantity as main-unit quantity. So `quantity = main_qty + (sub_qty * sub_unit.kg_value / unit.kg_value)`. For 3 Maund + 5 KG: `3 + (5*1/40) = 3.125 Maund`. Price per unit stays per Maund. Total = 3.125 * price_per_maund. Stock update: 3.125 * 40 = 125 KG. Everything stays consistent.

**Files**: `InvoiceItemRow.tsx` — add `main_qty`/`sub_qty` state, show two inputs when sub-unit exists, compute `quantity` automatically.

**Keyboard flow**: Main Qty → (Tab) → Sub Qty → (Tab) → Price → (Enter) → new row.

---

### 3. Horizontal Desktop-Friendly Invoice Layout

**SaleNew.tsx / PurchaseNew.tsx**: Remove `max-w-3xl` constraint, use full width.

**InvoiceForm.tsx**:
- **Party section**: 3–4 columns on desktop — Contact, Date, Payment Status, (Notes as collapsible or inline). For purchases: add Broker selector in this row.
- **Items section**: Each row is a true table-like horizontal row on desktop (already 12-col grid, but tighten it and make it flatter — remove card borders, use a table-header row for labels instead of per-row labels).
- **Summary + Payment**: Side-by-side on desktop instead of stacked. Summary on right, payment on left.

**InvoiceItemRow.tsx**:
- Remove per-row labels on desktop (use a header row in the parent).
- Remove card-style border/padding — use simple table rows with subtle dividers.
- Keep card style on mobile only.

---

### 4. Broker Support in Purchase Invoice

**InvoiceForm.tsx** (when `type === "purchase"`):
- In the Party section, add: Broker (searchable combobox, contact_type = 'broker' or 'both'), Commission Rate (number input), Commission Unit (unit selector).
- Auto-calculate `broker_commission_total = commission_rate * total_quantity_in_commission_unit`.
- The total quantity in commission unit = sum of all line items converted to that unit.
- Display broker commission total in the summary section.
- Save broker fields to the invoice.

**InvoiceDetail.tsx**: Show broker info if present on purchase invoices.

---

### 5. Translation Keys to Add

~20 new keys for: sub-unit labels ("Extra", sub-unit name), broker section ("Broker", "Commission Rate", "Commission Unit", "Commission Total"), layout labels.

---

### Files Changed

| File | Changes |
|------|---------|
| **Migration SQL** | Add `sub_unit_id` to units, add `broker` contact type, add broker columns to invoices |
| `src/components/InvoiceForm.tsx` | Horizontal layout, broker section for purchases, broker commission calc, wider party row |
| `src/components/InvoiceItemRow.tsx` | Sub-unit dual input, table-row style on desktop, header labels removed (moved to parent) |
| `src/pages/SaleNew.tsx` | Remove max-width constraint, full-width layout |
| `src/pages/PurchaseNew.tsx` | Remove max-width constraint, full-width layout |
| `src/components/InvoiceDetail.tsx` | Show broker info on purchase invoice detail |
| `src/contexts/LanguageContext.tsx` | Add ~20 new translation keys |
| `src/pages/Units.tsx` | Add sub-unit selector when creating/editing units |

### Calculation Integrity

- `quantity` field continues to store value in terms of the selected unit (e.g., 3.125 Maund)
- Stock updates: `quantity * unit.kg_value` = KG (unchanged)
- Price: `quantity * price_per_unit` = line total (unchanged)
- Broker commission is a separate stored field, does not affect invoice total or expenses

