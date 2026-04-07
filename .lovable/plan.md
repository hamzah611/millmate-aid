

## Fix Retained Earnings — Calculate from Actual P&L Data

### Problem
Line 328: `const retainedEarnings = totalAssets - totalLiabilities - capitalTotal;` forces the balance sheet to always appear balanced, hiding real errors.

### Solution
Add a new query to fetch revenue, COGS, and expenses, then calculate retained earnings as:
`retainedEarnings = totalRevenue - totalCOGS - totalExpenses`

### Changes — `src/components/reports/BalanceSheetProfessional.tsx`

**Add new query** (after capitalAccounts query, ~line 301):
```ts
const { data: retainedEarningsData } = useQuery({
  queryKey: ["bs-retained-earnings"],
  queryFn: async () => {
    const { data: sales } = await supabase.from("invoices").select("total").eq("invoice_type", "sale");
    const totalRevenue = sales?.reduce((s, i) => s + Number(i.total), 0) || 0;
    const { data: purchases } = await supabase.from("invoices").select("total").eq("invoice_type", "purchase");
    const totalCOGS = purchases?.reduce((s, i) => s + Number(i.total), 0) || 0;
    const { data: expenses } = await supabase.from("expenses").select("amount");
    const totalExpenses = expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0;
    return { totalRevenue, totalCOGS, totalExpenses, retainedEarnings: totalRevenue - totalCOGS - totalExpenses };
  },
});
```

**Update isLoading** (line 311): add `!retainedEarningsData`

**Replace line 328**:
```ts
const retainedEarnings = retainedEarningsData.retainedEarnings;
```

**Update drill-down UI** (lines 486-493) to show P&L breakdown:
```
- Total Revenue (Sales): ₨ X
- Less: Cost of Goods Sold: (₨ X)
- Less: Operating Expenses: (₨ X)
- = Retained Earnings: ₨ X
```

### Files changed

| File | Changes |
|---|---|
| `src/components/reports/BalanceSheetProfessional.tsx` | Add P&L query; replace forced retained earnings formula; update drill-down detail lines |

### No database changes needed.

