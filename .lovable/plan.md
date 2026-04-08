

## Fix DR/CR Logic in ContactLedger.tsx

### Summary
Remove all `isSupplier` conditionals from debit/credit assignment. Use invoice type and voucher type as the sole determinants. Fix untranslated keys with hardcoded fallbacks.

### Changes (single file: `src/pages/ContactLedger.tsx`)

**1. Remove `isSupplier` variable** (line 284)
Delete the line entirely.

**2. Opening balance row** (lines 299-300)
```
debit: openingBalance > 0 ? Math.abs(openingBalance) : 0,
credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
```

**3. Invoice rows** (lines 307, 313-314)
- Description: `inv.invoice_type === "sale" ? "Sale Invoice" : "Purchase Invoice"` (hardcoded, not t() which doesn't resolve)
- Debit/credit based on invoice type, not contact type:
```
debit: inv.invoice_type === "sale" ? (inv.total || 0) : 0,
credit: inv.invoice_type === "purchase" ? (inv.total || 0) : 0,
```

**4. Invoice-linked payment rows** (lines 332-333)
```
debit: p.voucher_type === "payment" ? (p.amount || 0) : 0,
credit: p.voucher_type === "receipt" ? (p.amount || 0) : 0,
```

**5. Balance display in table** (line 616)
Remove `isSupplier` ternary — always: `balance > 0 → "DR"` (red), `balance < 0 → "CR"` (green), `0 → "—"`

**6. Summary card** (line 529)
Same: `totalOutstanding > 0 → "DR"`, `< 0 → "CR"`, `0 → "Settled"`. Remove `isSupplier`.

**7. PDF export balance labels** (lines 416-419, 468)
Remove `isSupplier` — always `balance > 0 ? "DR" : "CR"`.

**8. CSV export balance labels** (lines 497-500, 507-509)
Same removal of `isSupplier`.

**9. Table header fallbacks** (lines 591-594)
Already have fallbacks on lines 592-594. Add fallback to line 591 for description: `t("common.description") || "Description"`.

### No other files changed. No database changes.

