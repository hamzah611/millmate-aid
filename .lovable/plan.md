

## Fix Balance Sheet Professional — 3 Bugs

### BUG 1 — Customer closing balance (lines 189-191)

Replace the single `directVoucherTotal` with split receipt/payment totals:

```ts
const receiptVoucherTotal = directVouchers.filter(v => v.voucher_type === "receipt").reduce((s, v) => s + Number(v.amount), 0);
const paymentVoucherTotal = directVouchers.filter(v => v.voucher_type === "payment").reduce((s, v) => s + Number(v.amount), 0);
const closingBalance = opening + invoiceBalanceDue - receiptVoucherTotal + paymentVoucherTotal;
```

Update the return object to include `receiptVoucherTotal` and `paymentVoucherTotal` instead of `directVoucherTotal`.

Update the customer detail line (line 400) to show separate receipt/payment voucher lines instead of a single "Direct Vouchers" line.

### BUG 2 — Supplier closing balance (lines 291-293)

Same split, but reversed logic for suppliers:

```ts
const receiptVoucherTotal = directVouchers.filter(v => v.voucher_type === "receipt").reduce((s, v) => s + Number(v.amount), 0);
const paymentVoucherTotal = directVouchers.filter(v => v.voucher_type === "payment").reduce((s, v) => s + Number(v.amount), 0);
const closingBalance = opening + invoiceBalanceDue - paymentVoucherTotal + receiptVoucherTotal;
```

Update supplier detail line (line 463) similarly.

### BUG 3 — Remove cash contacts double-counting

- Delete the `cashContacts` query (lines 127-137)
- Delete the `cashContacts` rendering block (lines 373-375)
- Remove `cashContacts` from any references

### Files changed

| File | Changes |
|---|---|
| `src/components/reports/BalanceSheetProfessional.tsx` | Fix customer/supplier closing formulas; remove cashContacts query and rendering |

