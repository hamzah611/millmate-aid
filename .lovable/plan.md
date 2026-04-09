

## Add Fresh Data Fetching to All Dashboard Queries

### File: `src/pages/Index.tsx`

Add `staleTime: 0` and `refetchOnMount: true` to all 9 `useQuery` calls:

1. `dashboard-today-sales`
2. `dashboard-today-purchases`
3. `dashboard-cash-in-hand`
4. `dashboard-receivables`
5. `dashboard-payables`
6. `dashboard-bank-balances`
7. `dashboard-employee-advances`
8. `dashboard-inventory-value`
9. `dashboard-low-stock`
10. `dashboard-overdue`

Each query gets two new properties added to its options object. No other changes.

