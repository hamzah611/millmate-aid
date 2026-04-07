

## Fix avg_cost Calculation in InvoiceForm.tsx

### Problem
`oldStock` is stored in KG internally, but `item.quantity` is in the invoice's unit (e.g. Maund). The current code needs both values in the same unit for weighted average to work correctly.

### Changes

**1. `src/components/InvoiceForm.tsx` — lines 392-397**

Replace the avg_cost calculation block with:
```ts
const purchaseUnitCost = item.total / item.quantity;
const kgValue = unit.kg_value > 0 ? unit.kg_value : 1;
const oldStockInUnits = oldStock / kgValue;
const itemQtyInUnits = item.quantity;
const newStockInUnits = oldStockInUnits + itemQtyInUnits;
const newAvgCost = newStockInUnits > 0
  ? ((oldStockInUnits * oldAvgCost) + (itemQtyInUnits * purchaseUnitCost)) / newStockInUnits
  : purchaseUnitCost;
```

**2. Database migration — reset avg_cost**

```sql
UPDATE products SET avg_cost = 0;
```

Resets all products so future purchases calculate correctly from scratch.

### No other changes.

