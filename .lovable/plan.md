

## Two Fixes: Cash Expenses Verification + Balance Sheet Debit/Credit Columns

### ISSUE 1 — Cash Expenses in Cash in Hand

**Already correct.** The `calculateCashInHand()` in `financial-utils.ts` (lines 50-53) already fetches cash expenses and subtracts them. The `CashInHandResult` interface includes `cashExpenses`. The return statement includes it. No changes needed. Will add a confirming comment only.

### ISSUE 2 — Balance Sheet: Two-Column Debit/Credit Layout

**File: `src/components/reports/BalanceSheetProfessional.tsx`**

**1. Rewrite `AccountLine` component** (lines 31-73)
- Change props from `{ name, balance, badge, children }` to `{ name, debit, credit, badge, children }`
- Show three columns: Account Name | Debit Amount | Credit Amount
- Only show amount in the relevant column, leave other blank

**2. Rewrite `TotalRow` component** (lines 106-113)
- Change props to `{ label, debit, credit, double }`
- Show debit total and credit total in separate columns

**3. Add column headers** after each `SectionHeader`
- Three columns: "Account" | "Debit (₨)" | "Credit (₨)"

**4. Update all `AccountLine` usages:**
- Cash in Hand: `debit={cashInHand}` `credit={0}`
- Banks: `debit={bank.balance}` `credit={0}`
- Customers: `debit={c.closingBalance > 0 ? c.closingBalance : 0}` `credit={c.closingBalance < 0 ? Math.abs(c.closingBalance) : 0}`
- Employees: `debit={e.closingBalance > 0 ? e.closingBalance : 0}` `credit={e.closingBalance < 0 ? Math.abs(e.closingBalance) : 0}`
- Inventory: `debit={p.value}` `credit={0}`
- Suppliers: `debit={0}` `credit={c.closingBalance}`
- Net Profit: `debit={retainedEarningsData > 0 ? retainedEarningsData : 0}` `credit={retainedEarningsData < 0 ? Math.abs(retainedEarningsData) : 0}`

**5. Update `TotalRow` usages:**
- TOTAL ASSETS: `debit={totalAssets}` `credit={0}`
- TOTAL LIABILITIES: `debit={0}` `credit={totalLiabilities}`

**6. Update final verification section** (lines 490-502)
- Show "Total Debits: X | Total Credits: Y"
- Balanced check: `Math.abs(totalDebits - totalCredits) < 1`

**7. Add confirming comment** in `financial-utils.ts` (line 50)

### Files Changed
1. `src/components/reports/BalanceSheetProfessional.tsx`
2. `src/lib/financial-utils.ts` (comment only)

No database changes.

