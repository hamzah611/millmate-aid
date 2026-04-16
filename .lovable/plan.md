

## DR/CR Audit Results and Fix Plan

After a thorough audit of every file that handles DR/CR logic, here are the findings:

### Files Audited (No Bugs Found)

1. **ContactLedger.tsx** — CORRECT. Sale=DR, Purchase=CR for invoices. Receipt=CR, Payment=DR for vouchers. Running balance formula `balance += debit - credit` works correctly for all contact types.

2. **BalanceSheetProfessional.tsx** — CORRECT. Customer closing = `opening + invoiceBalanceDue - receipts + payments`. Supplier closing = `opening - invoiceBalanceDue + payments - receipts`. Sign-aware display (`closingBalance > 0 → debit, < 0 → credit`).

3. **financial-utils.ts** — CORRECT. Cash = `opening + receipts - payments - expenses`. Bank = same formula. Employee advances = `opening + paidTo - receivedFrom`.

4. **RecordPayment.tsx** — CORRECT. Sale → receipt voucher, Purchase → payment voucher.

5. **VoucherNew.tsx** — CORRECT. Inserts with user-selected voucher_type.

6. **FinancialReports.tsx (P&L, Cash Flow)** — CORRECT. Revenue from sales, COGS from purchases, expenses subtracted. Cash flow: receipts=inflow, payments=outflow.

7. **CashClosingReport.tsx** — CORRECT. Uses cash perspective consistently.

### Bug Found: DailyTransactionsReport.tsx — Payment DR/CR shows cash perspective instead of party perspective

**The problem:** Each row displays the contact's name and account category, but receipts and payments use the cash-side DR/CR instead of the party-side DR/CR.

Current behavior:
- Receipt from customer "Suhail" → shows Debit=10,000 (cash increases)
- Payment to supplier "Imran" → shows Credit=100,000 (cash decreases)

This is wrong because the row identifies the party, not the cash account. From the party perspective:
- Receipt from customer → the customer's account should be **CR** (they paid, balance decreases)
- Payment to supplier → the supplier's account should be **DR** (you paid them, balance decreases)

**Fix in `src/components/reports/DailyTransactionsReport.tsx`, lines 67-68:**

Change:
```typescript
debit: isReceipt ? p.amount : 0,
credit: isReceipt ? 0 : p.amount,
```

To:
```typescript
debit: isReceipt ? 0 : p.amount,    // Payment made = DR (party account debited)
credit: isReceipt ? p.amount : 0,   // Receipt = CR (party account credited)
```

This is the only code change needed. Everything else in the codebase is already correct.

