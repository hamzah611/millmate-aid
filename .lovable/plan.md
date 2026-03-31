

## Fix: Opening Balances in Reports with Consistent Sign Convention

### Problem
1. Opening balances (stored in `contacts.opening_balance`) are invisible to Balance Sheet, Aging, and Contact Ledger reports because those reports only query `invoices`/`payments` tables
2. No `opening_balance_date` column exists, so there's no way to filter opening balances by date
3. Sign convention: positive = DR (owed to business), negative = CR (business owes) — this must be applied consistently
4. Aging report must always show contacts with outstanding opening balances regardless of date range, since these are carry-forward balances

### Database Migration

Add `opening_balance_date` to contacts, defaulting to `2025-12-03` for existing data:

```sql
ALTER TABLE public.contacts 
ADD COLUMN opening_balance_date date DEFAULT '2025-12-03';
```

### Changes

**1. Contact Form** (`ContactForm.tsx`)
- Add date picker field for `opening_balance_date` next to the opening balance input
- Default to today for new contacts

**2. Balance Sheet** (`FinancialReports.tsx` — `BalanceSheetReport`)
- Query contacts where `opening_balance != 0` and `opening_balance_date <= toDate` (date range picker added)
- Positive opening balances (DR) → add to Accounts Receivable (assets)
- Negative opening balances (CR, absolute value) → add to Accounts Payable (liabilities)
- Show as separate line items: "Opening Receivables" and "Opening Payables"

**3. Aging Report** (`AgingReport.tsx`)
- **Always include** contacts with non-zero opening balances, regardless of date range — these are carry-forward balances that remain outstanding until cleared
- Receivables tab: show contacts with positive `opening_balance` (DR = they owe us)
- Payables tab: show contacts with negative `opening_balance` (CR = we owe them)
- Age calculated from `opening_balance_date` to today
- Displayed alongside invoice-based aging entries with label "Opening Balance" instead of invoice number

**4. Contact Ledger** (`ContactLedger.tsx`)
- Show opening balance as the first row in invoice history with label "Opening Balance"
- Include it in the outstanding total calculation
- Sign: positive = receivable from contact, negative = payable to contact

**5. Translations** (`LanguageContext.tsx`)
- Add keys: `contacts.openingBalanceDate`, `reports.openingReceivables`, `reports.openingPayables`, `ledger.openingBalance`

### Files Changed

| File | Change |
|------|--------|
| Migration SQL | Add `opening_balance_date` column |
| `src/components/ContactForm.tsx` | Add date picker for opening balance date |
| `src/components/reports/FinancialReports.tsx` | Include opening balances in Balance Sheet |
| `src/components/reports/AgingReport.tsx` | Include opening balances (always, not date-filtered) |
| `src/pages/ContactLedger.tsx` | Show opening balance as first ledger entry |
| `src/contexts/LanguageContext.tsx` | Add translation keys |

### Sign Convention Summary

```text
opening_balance > 0  →  DR  →  Contact owes us    →  Asset (Receivable)
opening_balance < 0  →  CR  →  We owe contact     →  Liability (Payable)
opening_balance = 0  →  No entry in reports
```

Applied consistently across Ledger, Balance Sheet, and Aging.

