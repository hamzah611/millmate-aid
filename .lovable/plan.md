

## Fix Contact Ledger Debit/Credit Logic

### Changes in `src/pages/ContactLedger.tsx`

**1. Fix `isSupplier` definition (line 285)**
- Change to also check `account_category`: `const isSupplier = contact?.account_category === 'supplier' || contact?.contact_type === 'supplier' || contact?.contact_type === 'both';`

**2. Fix `totalOutstanding` (line 280)**
- For supplier: `openingBalance + invoiceBalanceDue - paymentVoucherTotal + receiptVoucherTotal`
- For customer: keep current formula `openingBalance + invoiceBalanceDue - receiptVoucherTotal + paymentVoucherTotal`

**3. Fix opening balance row (lines 292-302)**
- If `isSupplier`: positive → credit, negative → debit
- If customer: positive → debit, negative → credit

**4. Fix invoice rows (lines 305-317)**
- If `isSupplier`: debit=0, credit=inv.total
- If customer: debit=inv.total, credit=0

**5. Fix invoice-linked payment rows (lines 320-336)**
- If `isSupplier`: debit=p.amount, credit=0
- If customer: debit=0, credit=p.amount

**6. Direct vouchers (lines 339-355)**
- No change — receipt=credit, payment=debit stays the same for both

All changes are in the `unifiedEntries` useMemo and the `totalOutstanding` line. No other files affected.

