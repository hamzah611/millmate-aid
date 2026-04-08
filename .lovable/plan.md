
## Merge Product Expenses into Unified Ledger

### What Changes
Merge the separate "Product Expenses" table into the main transaction history table. Expenses will appear as rows alongside purchases, sales, adjustments, and productions — sorted by date. A badge will distinguish each entry type (e.g., "Expense" badge).

### File: `src/pages/ProductHistory.tsx`

**1. Add expenses to the `history` useMemo (around line 94)**
After the productions loop (line 191), add a loop over `expenses`:
```typescript
for (const exp of (expenses || [])) {
  const catName = exp.expense_categories
    ? (language === "ur" && (exp.expense_categories as any).name_ur
      ? (exp.expense_categories as any).name_ur
      : (exp.expense_categories as any).name)
    : "";
  entries.push({
    date: exp.expense_date,
    type: "Expense" + (catName ? ` — ${catName}` : ""),
    reference: exp.notes || "—",
    qtyIn: 0,
    qtyOut: 0,
    rate: 0,
    totalValue: Number(exp.amount),
  });
}
```
Add `expenses` and `language` to the useMemo dependency array.

**2. Update badge color logic in the table (line 388)**
Add an "Expense" variant — detect if type starts with "Expense" and use `"outline"` variant with a distinct style, while keeping existing badge logic for other types.

**3. Remove the separate "Product Expenses" section (lines 405-449)**
Delete the entire second table card that renders expenses separately.

**4. Update PDF export (lines 278-313)**
Remove the separate "Product Expenses" autoTable. Expenses are now already part of `historyWithBalance` and will appear in the main transaction table automatically.

### No other files changed. No database changes.
