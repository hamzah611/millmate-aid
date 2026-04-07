

## Fix DR/CR Display Logic in ContactLedger.tsx

Five targeted fixes in `src/pages/ContactLedger.tsx`. No other files changed.

### Fix 1 — Table row balance cell (line 604-606)

Compute `balanceLabel` and `balanceIsWarning` based on `isSupplier`, then use in the cell. Replace the current hardcoded `e.balance >= 0 ? "DR" : "CR"` logic.

### Fix 2 — Outstanding summary card (line 518)

Replace `totalOutstanding >= 0 ? "DR" : "CR"` with supplier-aware logic using `isSupplier`.

### Fix 3 — PDF ledger table balance text (line 415)

Replace `e.balance >= 0 ? "DR" : "CR"` with supplier-aware label. Handle `balance === 0` as "—".

### Fix 4 — PDF closing balance line (line 464)

Replace `closingBalance >= 0 ? "DR" : "CR"` with supplier-aware logic.

### Fix 5 — CSV export balance column (line 493)

Replace raw `e.balance` number with formatted string including DR/CR label using same supplier-aware logic.

Also update closing balance row in CSV (line 499) similarly.

### Summary of the label logic (applied everywhere)

```
if balance === 0 → "—"
else if isSupplier → balance > 0 ? "CR" : "DR"
else → balance > 0 ? "DR" : "CR"
```

Color: red/destructive when the label indicates money owed (DR for customer, CR for supplier — i.e. `balance > 0`), green otherwise.

