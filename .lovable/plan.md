

## Remove Closing/Capital Accounts from Balance Sheet

### Problem
Contacts with `account_category = "closing"` are settled accounts with no remaining balance. They should not appear in the balance sheet at all — no Equity/Capital section needed.

### Changes

**1. `src/components/reports/BalanceSheetProfessional.tsx`**

- Delete the `capitalAccounts` useQuery (lines 291-301)
- Delete the `retainedEarningsData` useQuery (lines 310-321)
- Remove `capitalAccounts` and `retainedEarningsData` from `isLoading` check (line 325)
- Remove `capitalTotal`, `retainedEarnings`, `totalEquity`, `totalLiabEquity` calculations (lines 341-344)
- Update `isBalanced` to compare `totalAssets` vs `totalLiabilities` (line 345)
- Remove the entire EQUITY / CAPITAL section from JSX (lines 487-509): SectionHeader, SubSectionHeader "Capital Accounts", capitalAccounts mapping, DottedLine, Retained Earnings AccountLine, TOTAL EQUITY TotalRow
- Update the final footer (lines 511-523): change "TOTAL LIABILITIES + EQUITY" to "TOTAL LIABILITIES", remove equity from verification formula, compare against `totalLiabilities`
- Update the balance warning (lines 351-359) to reference `totalLiabilities` instead of `totalLiabEquity`

**2. `src/components/reports/FinancialReports.tsx`**

- Delete `showCapital` state and `capitalList` useQuery (lines 666-679)
- Remove `capitalEquity` variable (line 702)
- Remove `retainedEarnings` calculation (line 703)
- Remove `totalEquity` calculation (line 704)
- Change `totalLiabilitiesAndEquity` to just `totalLiabilities` (line 705)
- Update `isBalanced` to compare `totalAssets` vs `totalLiabilities` (line 707)
- In CSV export: remove closing accounts, retained earnings, and equity rows (lines 755-758), update final row to use `totalLiabilities`
- In the Liabilities card header: remove "+ Equity" text (line 895)
- Remove the entire Equity/Capital section from UI (lines 923-949): BSectionHeader, BSCollapsibleItem for closing accounts, BSCollapsibleItem for retained earnings, totalEquity display
- Update BSTotalRow to show just "Total Liabilities" with `totalLiabilities` value (line 951)

**3. `src/lib/financial-utils.ts`**

- Remove `capitalEquity` from the `CategoryBalances` interface
- Remove the `case "closing":` from the switch in `fetchCategoryBalances()` (so closing balances are simply ignored)

**4. Verification — no other leakage**

Customer queries already filter by `account_category = "customer"` and supplier queries by `account_category = "supplier"`, so closing contacts are naturally excluded from those sections. No changes needed there.

### No database changes. No other files changed.

