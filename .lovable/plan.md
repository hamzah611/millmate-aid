

## Analysis: No Changes Needed

After inspecting the actual code, the receivables and payables calculations are already clean and do **not** include standalone vouchers.

### Current Receivables Logic (`Index.tsx` line 93-101, `DashboardBreakdown.tsx` line 142-170)
```
Receivables = invoices(sale).balance_due + contacts(customer).opening_balance
```
No reference to payments table. No standalone voucher logic.

### Current Payables Logic (`Index.tsx` line 103-111, `DashboardBreakdown.tsx` line 173-200)
```
Payables = invoices(purchase).balance_due + contacts(supplier).opening_balance
```
No reference to payments table. No standalone voucher logic.

### Cash/Bank Logic (`Index.tsx` line 51-91, 113-140)
Already sums ALL payments by method (cash/bank) regardless of `invoice_id` — standalone vouchers automatically affect cash/bank. This is correct per the requirement.

### Contact Ledger (`ContactLedger.tsx`)
Already queries payments linked to a contact's invoices — standalone vouchers with `contact_id` but no `invoice_id` would need a separate query to appear here, but that's a separate concern (showing in ledger, not affecting global receivables/payables).

### Conclusion
There is **no code to remove**. The previous plan proposed adding standalone voucher deductions to receivables/payables, but that code was never implemented. The current state already matches the desired behavior:
- Standalone vouchers affect cash/bank only
- Receivables/payables use invoice balances + opening balances only

No changes required.

