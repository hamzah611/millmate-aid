

## Phase 1: Financial Foundation Fix

### Verified Data (from database)

| Category | Count | Raw Sum (₨) | Notes |
|----------|-------|-------------|-------|
| cash | 5 | -5,683,150 | Mix: +3,329,703 and -9,012,853 |
| bank | 3 | 527,219 | Mix: MCB +1,542,079, Cheques -1,015,360, NBP +500 |
| closing | 31 | +3,991,874 | All positive (small settlement balances) |
| customer | 59 | +2,499,700 | All positive (they owe us) |
| supplier | 34 | -2,349,118 | All negative (we owe them) |
| employee | 8 | +237,910 | All positive (advances given) |

### Sign Handling Rules

- **Cash/Bank**: Use raw sum as-is. Negative cash means net cash deficit — display honestly, do not flip sign.
- **Customer**: Use raw sum (positive = receivable). Any negative customer balances would reduce the total.
- **Supplier**: Use `abs(sum)` for display since all are negative (payable). Label clearly.
- **Employee**: Use raw sum (positive = advances/receivable).
- **Closing**: Use raw sum as Capital/Equity. No retained earnings calculation — just show "Capital (Closing Accounts)" with the total. Simple and honest.

---

### Changes

#### 1. New file: `src/lib/financial-utils.ts`

Shared helper querying contacts by `account_category` and returning categorized sums. Used by both Dashboard and Balance Sheet to avoid duplicate logic.

```typescript
// Returns: { cashBalance, bankBalance, customerReceivables, supplierPayables, employeeReceivables, capitalEquity }
// All values are raw sums — caller decides display formatting
// Optional dateFilter: only include where opening_balance_date <= toDate
```

#### 2. Balance Sheet rewrite (`FinancialReports.tsx` — `BalanceSheetReport`)

Replace generic openingReceivables/openingPayables with category-aware lines:

```text
ASSETS
  Cash in Hand .............. raw sum of cash category opening balances
  Bank Accounts ............. raw sum of bank category opening balances
  Customer Receivables ...... customer opening balances + sale invoice balance_due
  Employee Receivables ...... employee opening balances
  Inventory ................. (existing logic unchanged)

LIABILITIES
  Supplier Payables ......... abs(supplier opening balances) + purchase invoice balance_due

CAPITAL / EQUITY
  Closing Accounts .......... raw sum of closing category opening balances
```

- Filter: `opening_balance_date <= toDate` (cumulative, no fromDate — balance sheet is a point-in-time snapshot)
- No retained earnings line — just show the capital total directly
- Equity summary card shows Capital total, not Assets minus Liabilities

#### 3. Dashboard fixes (`Index.tsx`)

**Cash in Hand** — current query + opening cash:
```
opening cash balance (category='cash')
+ sale invoice amount_paid
- purchase invoice amount_paid  
- cash expenses
```
Expected initial value: -5,683,150 + 0 - 0 - 0 = -5,683,150 (honest — will improve as sales come in)

**Receivables** — add customer openings:
```
sale invoice balance_due + customer opening balances
```
Expected: 0 + 2,499,700 = 2,499,700

**Payables** — add supplier openings:
```
purchase invoice balance_due + abs(supplier opening balances)
```
Expected: 0 + 2,349,118 = 2,349,118

**New card: Bank Balance** — opening bank sum only for now:
```
sum(opening_balance) where account_category = 'bank'
```
Expected: 527,219

Grid changes from 6 to 7 cards. Add `bank` to `iconBg` map. Adjust grid to `xl:grid-cols-7`.

#### 4. Translation keys (`LanguageContext.tsx`)

Add ~8 keys:
- `dashboard.bankBalance` — "Bank Balance" / "بینک بیلنس"
- `reports.cashInHand` — "Cash in Hand" / "نقد رقم"
- `reports.bankAccounts` — "Bank Accounts" / "بینک اکاؤنٹس"
- `reports.customerReceivables` — "Customer Receivables" / "صارفین واجب الادا"
- `reports.supplierPayables` — "Supplier Payables" / "سپلائر واجبات"
- `reports.employeeReceivables` — "Employee Receivables" / "ملازمین بقایا"
- `reports.capitalEquity` — "Capital / Equity" / "سرمایہ"
- `reports.closingAccounts` — "Closing Accounts" / "بند اکاؤنٹس"

### Files Changed

| File | Change |
|------|--------|
| `src/lib/financial-utils.ts` | **New** — shared opening balance classification helper |
| `src/components/reports/FinancialReports.tsx` | Rewrite `BalanceSheetReport` with category-aware lines, no retained earnings |
| `src/pages/Index.tsx` | Fix Cash/Receivables/Payables + add Bank Balance card (7-card grid) |
| `src/contexts/LanguageContext.tsx` | Add translation keys |

No database changes needed.

